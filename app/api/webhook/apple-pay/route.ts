import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyRefresh } from "@/lib/sse";
import { requireWebhookAuth } from "@/lib/webhookAuth";
import { guessTransactionCategory } from "@/lib/placeCategory";
import { checkAndSendBudgetAlert } from "@/lib/budgetAlerts";
import { getHouseholdContext } from "@/lib/household";
import { getRateLimitKey, isRateLimited, recordFailedAttempt } from "@/lib/rateLimit";

// Accepte soit un token de webhook dédié (header `Authorization: Bearer
// <token>`, généré depuis la page Profil — utilisé par l'iOS Shortcut),
// soit le cookie de session classique (appel depuis l'app elle-même).
export async function POST(req: Request) {
  // Rate limit sur les échecs SEULEMENT (jamais sur les appels réussis) —
  // le token étant un secret 256 bits, un brute-force réel est déjà
  // irréaliste ; ça sert surtout à limiter le bruit/DoS de requêtes
  // invalides, sans jamais pénaliser l'utilisateur légitime qui peut
  // déclencher ce webhook plusieurs fois par jour (un achat = un appel).
  const rateLimitKey = getRateLimitKey("webhook-apple-pay", req);
  const { limited, retryAfterSeconds } = isRateLimited(rateLimitKey);
  if (limited) {
    return NextResponse.json(
      { error: "Trop de tentatives échouées. Réessaie plus tard." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds ?? 60) } },
    );
  }

  try {
    const { userId } = await requireWebhookAuth(req);
    const { merchant, amount, date, location, latitude, longitude } =
      await req.json();
    const absAmount = Math.abs(amount);

    // Best-effort : deviner la catégorie via la position GPS avant d'ouvrir
    // la transaction DB (on ne veut pas garder une transaction SQLite
    // ouverte pendant un appel réseau externe). Échec/absence de
    // coordonnées => on retombe simplement sur "Uncategorized" comme avant.
    //
    // Le Shortcut iOS envoie parfois la latitude/longitude sans séparateur
    // décimal (ex: 33.615887 -> 3361588763878096), probablement un souci de
    // formatage côté Shortcuts (locale/type de champ JSON). On rejette toute
    // valeur hors des bornes GPS valides plutôt que d'interroger Overpass
    // avec des coordonnées absurdes ou de les stocker telles quelles.
    const rawLat = typeof latitude === "number" ? latitude : Number(latitude);
    const rawLng = typeof longitude === "number" ? longitude : Number(longitude);
    const hasValidCoords =
      Number.isFinite(rawLat) &&
      Number.isFinite(rawLng) &&
      Math.abs(rawLat) <= 90 &&
      Math.abs(rawLng) <= 180;
    const lat = hasValidCoords ? rawLat : null;
    const lng = hasValidCoords ? rawLng : null;
    if (latitude === undefined && longitude === undefined) {
      console.log(
        "Apple Pay Webhook: pas de latitude/longitude dans le body — catégorisation par position sautée (Uncategorized par défaut).",
      );
    } else if (!hasValidCoords) {
      console.warn(
        `Apple Pay Webhook: coordonnées GPS invalides ignorées (latitude=${latitude}, longitude=${longitude}) — vérifie le format envoyé par le Shortcut.`,
      );
    }
    // Essaie d'abord de deviner la catégorie depuis le seul nom du marchand
    // (gratuit, pas d'appel réseau) ; Geoapify n'est appelé qu'en repli, et
    // seulement si des coordonnées valides sont disponibles.
    const placeGuess = await guessTransactionCategory({ merchantName: merchant, lat, lng });
    if (!placeGuess && lat !== null && lng !== null) {
      console.log(
        `Apple Pay Webhook: aucune catégorie devinée (nom + position) pour "${merchant}" — Uncategorized par défaut.`,
      );
    }

    const ctx = await getHouseholdContext(userId);

    const result = await prisma.$transaction(async (tx) => {
      let account = await tx.account.findFirst({
        where: { userId: { in: ctx.memberIds }, name: "Main Checking" },
      });

      if (!account) {
        account = await tx.account.create({
          data: { userId, name: "Main Checking", type: "checking", balance: 0 },
        });
      }

      let category = placeGuess
        ? await tx.category.findFirst({
            where: { userId: ctx.budgetOwnerId, name: placeGuess.categoryName },
          })
        : null;

      if (!category) {
        category = await tx.category.findFirst({
          where: { userId: ctx.budgetOwnerId, name: "Uncategorized" },
        });
      }

      if (!category) {
        category = await tx.category.create({
          data: { userId: ctx.budgetOwnerId, name: "Uncategorized", type: "expense" },
        });
      }

      const savingsGoals = await tx.savingsGoal.findMany({ where: { userId: { in: ctx.memberIds } } });
      const totalSavingsLocked = savingsGoals.reduce(
        (acc, goal) => acc + goal.currentAmount,
        0,
      );
      const safeToSpend = account.balance - totalSavingsLocked;

      const isRejected = safeToSpend - absAmount < 0;

      const expenseAmount = absAmount * -1;
      const merchantName = isRejected
        ? `[REJECTED/OVER BUDGET] ${merchant}`
        : merchant;
      const locationUser = location || null;
      console.log(
        `Apple Pay Webhook: Merchant: ${merchantName}, Amount: ${expenseAmount}, Date: ${date}, Location: ${locationUser}, Safe to Spend: ${safeToSpend}, Rejected: ${isRejected}`,
      );

      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId: account.id,
          categoryId: category.id,
          subCategory: placeGuess?.subCategoryName ?? null,
          merchant: merchantName,
          amount: expenseAmount,
          date: new Date(date),
          location: locationUser,
          latitude: lat,
          longitude: lng,
          isRejected,
        },
      });

      if (!isRejected) {
        await tx.account.update({
          where: { id: account.id },
          data: { balance: { decrement: absAmount } },
        });
      }

      return { transaction, isRejected };
    });

    // Après coup, jamais bloquant — voir lib/budgetAlerts.ts. Compte même si
    // isRejected=true : la transaction est réellement créée dans les deux
    // cas (seul le solde du compte n'est pas débité si rejetée), donc elle
    // pèse bien sur le budget de la catégorie.
    await checkAndSendBudgetAlert(userId, result.transaction.categoryId, result.transaction.date);

    if (result.isRejected) {
      notifyRefresh();
      return NextResponse.json(
        {
          error:
            "Transaction logged but rejected: Exceeds Safe to Spend limit.",
          transaction: result.transaction,
        },
        { status: 403 },
      );
    }

    notifyRefresh();
    return NextResponse.json({
      success: true,
      transaction: result.transaction,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      recordFailedAttempt(rateLimitKey);
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    console.error("Apple Pay Webhook Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
