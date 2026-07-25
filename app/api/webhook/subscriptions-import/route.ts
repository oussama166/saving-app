import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWebhookAuth } from "@/lib/webhookAuth";
import { catchUpSubscriptionCharges } from "@/lib/subscriptions";
import { findCatalogEntryByName, findClosestPlan } from "@/lib/subscriptionCatalog";
import { normalizeMerchantName } from "@/lib/merchantName";
import { detectPlanChange } from "@/lib/subscriptionPlanChange";

const DEFAULT_SUBSCRIPTION_CATEGORY_NAME = "Tech & Abonnements";

interface SubscriptionImportItem {
  name?: string;
  price?: number | string;
  billingDay?: number | string;
  date?: string;
}

interface ItemResult {
  input: string;
  status: "created" | "updated" | "skipped" | "error";
  detail: string;
  name?: string;
}

// Import en masse depuis un Shortcut iOS qui scanne les SMS pour repérer des
// abonnements (ex: automatisation "Trouver les messages contenant
// 'prélevé'/'abonnement'" -> extraire nom + montant de chaque match).
//
// Contrairement à /api/webhook/subscription-payment (qui exige que
// l'abonnement existe déjà, logue un prélèvement, et ne s'occupe QUE d'un
// abonnement à la fois), cette route traite un lot entier :
// - nom inconnu -> crée un nouvel abonnement.
// - nom déjà connu ET le montant révèle un changement de plan (même
//   détection que subscription-payment, voir lib/subscriptionPlanChange.ts)
//   -> met à jour le prix/nom de l'abonnement et trace le changement dans
//   SubscriptionPlanChange (visible dans l'historique, page Abonnements).
// - nom déjà connu et montant inchangé -> ne fait rien (idempotent, un
//   Shortcut relancé sur les mêmes SMS ne duplique/modifie rien à tort).
export async function POST(req: Request) {
  try {
    const { userId } = await requireWebhookAuth(req);
    const body = await req.json();
    const { subscriptions } = body as { subscriptions?: SubscriptionImportItem[] };

    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      return NextResponse.json(
        { error: 'Champ "subscriptions" requis : tableau non vide de { name, price, billingDay?, date? }.' },
        { status: 400 },
      );
    }

    // Compte et catégorie par défaut, résolus une seule fois pour tout le
    // lot (le Shortcut n'a pas de moyen simple de préciser l'un ou l'autre
    // par SMS) — "Tech & Abonnements" est la catégorie par défaut créée à
    // l'inscription (voir lib/seedDefaults.ts), avec repli sur la première
    // catégorie de dépense si l'utilisateur l'a renommée/supprimée.
    const [account, defaultCategory, fallbackCategory, existingSubscriptions] = await Promise.all([
      prisma.account.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } }),
      prisma.category.findFirst({ where: { userId, name: DEFAULT_SUBSCRIPTION_CATEGORY_NAME } }),
      prisma.category.findFirst({ where: { userId, type: "expense" }, orderBy: { order: "asc" } }),
      prisma.subscription.findMany({ where: { userId } }),
    ]);

    if (!account) {
      return NextResponse.json(
        { error: "Aucun compte trouvé sur ce profil — impossible de créer des abonnements sans compte." },
        { status: 400 },
      );
    }
    const category = defaultCategory ?? fallbackCategory;
    if (!category) {
      return NextResponse.json(
        { error: "Aucune catégorie de dépense trouvée sur ce profil." },
        { status: 400 },
      );
    }

    const results: ItemResult[] = [];
    // Liste vivante des abonnements connus (existants + créés pendant ce
    // lot) — utilisée pour la correspondance tolérante ET pour retrouver
    // l'enregistrement complet à mettre à jour, pas juste un booléen.
    const knownSubs = existingSubscriptions.map((s) => ({
      id: s.id,
      name: s.name,
      provider: s.provider,
      price: s.price,
    }));

    const matchExisting = (needle: string) =>
      knownSubs.find(
        (s) =>
          s.name.toLowerCase() === needle ||
          (s.provider ?? "").toLowerCase() === needle,
      ) ??
      knownSubs.find(
        (s) =>
          s.name.toLowerCase().includes(needle) ||
          needle.includes(s.name.toLowerCase()) ||
          (s.provider &&
            (s.provider.toLowerCase().includes(needle) || needle.includes(s.provider.toLowerCase()))),
      );

    for (const item of subscriptions) {
      const rawName = typeof item?.name === "string" ? item.name.trim() : "";
      if (!rawName) {
        results.push({ input: JSON.stringify(item), status: "error", detail: 'Champ "name" manquant.' });
        continue;
      }

      const priceNum = Number(item?.price);
      if (!Number.isFinite(priceNum) || priceNum <= 0) {
        results.push({ input: rawName, status: "error", detail: `Prix invalide : "${item?.price}".` });
        continue;
      }

      const cleanedName = normalizeMerchantName(rawName);
      const needle = cleanedName.toLowerCase();
      const existing = matchExisting(needle);

      if (existing) {
        const change = detectPlanChange(existing, priceNum);
        if (!change) {
          results.push({ input: rawName, status: "skipped", detail: "Déjà à jour, rien à changer." });
          continue;
        }

        // Même forme batch $transaction([...]) que subscription-payment
        // (plus fiable contre l'adapter libSQL/Turso à distance qu'une
        // transaction interactive) : met à jour l'abonnement et trace le
        // changement en une seule fois, atomiquement.
        await prisma.$transaction([
          prisma.subscription.update({
            where: { id: existing.id },
            data: { name: change.newName, price: change.newPrice },
          }),
          prisma.subscriptionPlanChange.create({
            data: {
              subscriptionId: existing.id,
              userId,
              previousName: change.previousName,
              newName: change.newName,
              previousPrice: change.previousPrice,
              newPrice: change.newPrice,
            },
          }),
        ] as Prisma.PrismaPromise<unknown>[]);

        existing.name = change.newName;
        existing.price = change.newPrice;

        results.push({
          input: rawName,
          status: "updated",
          detail: `Plan changé : ${change.previousName} (${change.previousPrice.toFixed(2)} DH) → ${change.newName} (${change.newPrice.toFixed(2)} DH).`,
          name: change.newName,
        });
        continue;
      }

      let billingDay = Number(item?.billingDay);
      if (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) {
        if (item?.date) {
          const parsedDate = new Date(item.date);
          billingDay = Number.isNaN(parsedDate.getTime()) ? new Date().getDate() : parsedDate.getDate();
        } else {
          billingDay = new Date().getDate();
        }
      }

      const catalogEntry = findCatalogEntryByName(cleanedName);
      const provider = catalogEntry?.key ?? null;
      const subCategory = catalogEntry?.suggestedSubCategory ?? null;
      const finalName =
        catalogEntry && catalogEntry.plans.length > 1
          ? `${catalogEntry.name} (${findClosestPlan(catalogEntry, priceNum).label})`
          : catalogEntry?.name ?? cleanedName;

      const created = await prisma.subscription.create({
        data: {
          userId,
          accountId: account.id,
          categoryId: category.id,
          name: finalName,
          provider,
          subCategory,
          price: priceNum,
          billingDay,
          isActive: true,
        },
      });

      // Évite qu'un même nom du même lot ne soit créé deux fois (ex: deux
      // SMS différents pour le même abonnement dans une seule requête).
      knownSubs.push({ id: created.id, name: created.name, provider, price: created.price });

      results.push({ input: rawName, status: "created", detail: "Abonnement créé.", name: created.name });
    }

    // Rattrape immédiatement les prélèvements déjà dus pour les nouveaux
    // abonnements (même logique que POST /api/subscriptions).
    const createdCount = results.filter((r) => r.status === "created").length;
    if (createdCount > 0) {
      await catchUpSubscriptionCharges(userId);
    }

    return NextResponse.json({
      success: true,
      summary: {
        created: createdCount,
        updated: results.filter((r) => r.status === "updated").length,
        skipped: results.filter((r) => r.status === "skipped").length,
        errors: results.filter((r) => r.status === "error").length,
      },
      results,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    console.error("Subscriptions Import Webhook Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
