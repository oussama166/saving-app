import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWebhookAuth } from "@/lib/webhookAuth";
import { catchUpSubscriptionCharges } from "@/lib/subscriptions";
import { findCatalogEntryByName, findClosestPlan } from "@/lib/subscriptionCatalog";
import { normalizeMerchantName } from "@/lib/merchantName";

const DEFAULT_SUBSCRIPTION_CATEGORY_NAME = "Tech & Abonnements";

interface SubscriptionImportItem {
  name?: string;
  price?: number | string;
  billingDay?: number | string;
  date?: string;
}

interface ItemResult {
  input: string;
  status: "created" | "skipped" | "error";
  detail: string;
  name?: string;
}

// Import en masse depuis un Shortcut iOS qui scanne les SMS pour repérer des
// abonnements (ex: automatisation "Trouver les messages contenant
// 'prélevé'/'abonnement'" -> extraire nom + montant de chaque match) et les
// crée tous d'un coup, plutôt que de les ajouter un par un à la main sur la
// page Abonnements.
//
// Contrairement à /api/webhook/subscription-payment (qui exige que
// l'abonnement existe déjà et logue juste un prélèvement dessus), cette
// route CRÉE de nouveaux abonnements — mais uniquement s'ils n'existent pas
// déjà (comparaison tolérante par nom, même logique que
// subscription-payment), pour qu'un Shortcut relancé plusieurs fois sur les
// mêmes SMS ne duplique rien.
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
    const knownNames = existingSubscriptions.map((s) => ({
      name: s.name.toLowerCase(),
      provider: (s.provider ?? "").toLowerCase(),
    }));

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

      // Même correspondance tolérante que subscription-payment : évite de
      // recréer "Netflix" si "netflix.com" ou "NETFLIX" existe déjà, y
      // compris parmi les abonnements désactivés (pas la peine de dupliquer
      // un abonnement mis en pause).
      const alreadyExists = knownNames.some(
        (k) =>
          k.name === needle ||
          k.provider === needle ||
          k.name.includes(needle) ||
          needle.includes(k.name) ||
          (k.provider && (k.provider.includes(needle) || needle.includes(k.provider))),
      );
      if (alreadyExists) {
        results.push({ input: rawName, status: "skipped", detail: "Un abonnement correspondant existe déjà." });
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
      knownNames.push({ name: created.name.toLowerCase(), provider: (provider ?? "").toLowerCase() });

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
