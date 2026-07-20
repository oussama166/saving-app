import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWebhookAuth } from "@/lib/webhookAuth";
import { notifyRefresh } from "@/lib/sse";
import { formatYearMonth } from "@/lib/subscriptions";
import { findCatalogEntry, findClosestPlan } from "@/lib/subscriptionCatalog";
import { normalizeMerchantName } from "@/lib/merchantName";

// Tolérance (MAD) en dessous de laquelle on considère que le montant reçu
// correspond au plan déjà enregistré — évite de renommer l'abonnement pour
// de simples arrondis/frais bancaires plutôt qu'un vrai changement de plan.
const PLAN_CHANGE_TOLERANCE_MAD = 1;

// Version "temps réel" du rattrapage d'abonnements (voir aussi
// /api/webhook/subscriptions-sync pour la version "tout le mois d'un
// coup") : pensé pour un Shortcut iOS qui intercepte la notification/SMS de
// prélèvement bancaire dès qu'elle arrive (ex: automatisation "Quand je
// reçois une notification contenant Netflix") et logue la transaction
// immédiatement, plutôt que d'attendre le prochain chargement de l'app.
//
// On ne crée PAS de nouvel abonnement à la volée si le nom ne correspond à
// rien : un SMS mal parsé créerait silencieusement un abonnement fantôme.
// L'abonnement doit déjà exister (page Abonnements) — ce webhook se contente
// d'enregistrer un prélèvement dessus.
export async function POST(req: Request) {
  try {
    const { userId } = await requireWebhookAuth(req);
    const body = await req.json();
    const { name, amount, date } = body as {
      name?: string;
      amount?: number | string;
      date?: string;
    };

    const searchName = typeof name === "string" ? name.trim() : "";
    if (!searchName) {
      return NextResponse.json(
        {
          error:
            'Champ "name" requis (nom du marchand/abonnement tel que reçu, ex: "Netflix").',
        },
        { status: 400 },
      );
    }

    // `amount` est optionnel : si absent (ou vide), on retombe sur le prix
    // enregistré de l'abonnement plutôt que d'exiger que le Shortcut extraie
    // un montant du texte de la notification (pas toujours fiable).
    let parsedAmount: number | null = null;
    if (amount !== undefined && amount !== null && amount !== "") {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) {
        return NextResponse.json(
          {
            error: `Champ "amount" invalide : "${amount}" n'est pas un nombre positif.`,
          },
          { status: 400 },
        );
      }
      parsedAmount = n;
    }

    const chargeDate = date ? new Date(date) : new Date();
    if (Number.isNaN(chargeDate.getTime())) {
      return NextResponse.json(
        {
          error: `Champ "date" invalide : "${date}" n'est pas une date reconnue (utilise un format ISO 8601).`,
        },
        { status: 400 },
      );
    }

    // Correspondance tolérante : le nom du marchand tel qu'il apparaît dans
    // une notification bancaire ne colle pas toujours exactement au nom
    // enregistré ("NETFLIX.COM" vs "Netflix") — on nettoie d'abord les
    // préfixes/suffixes de type domaine ou code de référence court
    // ("startselect.help" -> "startselect", "Glovo_pz" -> "Glovo", voir
    // lib/merchantName.ts), puis on compare en minuscules sur le nom ET le
    // provider (clé catalogue), avec un repli sur une correspondance
    // partielle (inclusion dans un sens ou l'autre).
    const activeSubs = await prisma.subscription.findMany({
      where: { userId, isActive: true },
    });
    const cleanedSearchName = normalizeMerchantName(searchName);
    const needle = cleanedSearchName.toLowerCase();
    const subscription =
      activeSubs.find(
        (s) =>
          s.name.toLowerCase() === needle ||
          (s.provider ?? "").toLowerCase() === needle,
      ) ??
      activeSubs.find(
        (s) =>
          s.name.toLowerCase().includes(needle) ||
          needle.includes(s.name.toLowerCase()) ||
          (s.provider &&
            (s.provider.toLowerCase().includes(needle) ||
              needle.includes(s.provider.toLowerCase()))),
      );

    if (!subscription) {
      const cleanedNote = cleanedSearchName !== searchName ? ` (nettoyé en "${cleanedSearchName}")` : "";
      return NextResponse.json(
        {
          error: `Aucun abonnement actif ne correspond à "${searchName}"${cleanedNote}. Crée-le d'abord sur la page Abonnements, ou vérifie l'orthographe.`,
        },
        { status: 404 },
      );
    }

    const yearMonthKey = formatYearMonth(
      chargeDate.getFullYear(),
      chargeDate.getMonth() + 1,
    );

    // Idempotent : si ce mois est déjà marqué comme prélevé pour cet
    // abonnement (par ce webhook, par le rattrapage automatique, ou par
    // /api/webhook/subscriptions-sync), on ne double-charge pas — utile si
    // le Shortcut se déclenche deux fois pour la même notification, ou si
    // l'app a déjà rattrapé ce mois entre-temps.
    if (subscription.lastChargedYearMonth === yearMonthKey) {
      return NextResponse.json({
        success: true,
        alreadyCharged: true,
        message: `"${subscription.name}" est déjà marqué comme prélevé pour ${yearMonthKey} — rien créé.`,
      });
    }

    const chargeAmount = -Math.abs(parsedAmount ?? subscription.price);

    // Détection de plan (Premium/Standard/Essentiel...) à partir du seul
    // montant reçu : seulement si (a) un montant a été explicitement fourni
    // (sinon on ne fait que reprendre le prix déjà connu, rien à détecter),
    // et (b) l'abonnement vient du catalogue (`provider`) avec plusieurs
    // formules possibles (lib/subscriptionCatalog.ts). On compare au plan
    // dont le prix est le plus proche, et on ne renomme que si l'écart
    // dépasse une petite tolérance (arrondis/frais bancaires).
    //
    // Note : le libellé du plan vit dans `Subscription.name` (convention
    // déjà utilisée par le formulaire manuel, ex: "Netflix (Premium)"), PAS
    // dans `subCategory` — ce dernier reste la catégorie large ("Streaming
    // Vidéo") suggérée par le catalogue, partagée par tous les plans d'un
    // même service, donc pas le bon endroit pour refléter un changement de
    // formule.
    let detectedPlanChange: {
      previousName: string;
      newName: string;
      label: string;
    } | null = null;
    if (parsedAmount !== null && subscription.provider) {
      const catalogEntry = findCatalogEntry(subscription.provider);
      if (catalogEntry && catalogEntry.plans.length > 1) {
        const closestPlan = findClosestPlan(catalogEntry, parsedAmount);
        const priceDrifted =
          Math.abs(closestPlan.price - subscription.price) >
          PLAN_CHANGE_TOLERANCE_MAD;
        const newName = `${catalogEntry.name} (${closestPlan.label})`;
        if (priceDrifted && newName !== subscription.name) {
          detectedPlanChange = {
            previousName: subscription.name,
            newName,
            label: closestPlan.label,
          };
        }
      }
    }

    // $transaction([...]) (forme batch) plutôt que la forme interactive
    // `async (tx) => {...}` : plus fiable contre l'adapter libSQL/Turso à
    // distance (voir lib/subscriptions.ts pour le même choix et pourquoi).
    const [transaction] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          userId,
          accountId: subscription.accountId,
          categoryId: subscription.categoryId,
          subCategory: subscription.subCategory,
          paymentMethod: null,
          merchant: subscription.name,
          amount: chargeAmount,
          date: chargeDate,
          subscriptionId: subscription.id,
        },
      }),
      prisma.account.update({
        where: { id: subscription.accountId },
        data: { balance: { increment: chargeAmount } },
      }),
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          lastChargedYearMonth: yearMonthKey,
          // Le prix stocké suit le montant réellement observé (utilisé par
          // le rattrapage automatique les mois suivants — voir
          // lib/subscriptions.ts), et le nom reflète le plan détecté s'il a
          // changé.
          price: Math.abs(parsedAmount ?? subscription.price),
          ...(detectedPlanChange ? { name: detectedPlanChange.newName } : {}),
        },
      }),
    ]);

    notifyRefresh();

    return NextResponse.json({
      success: true,
      transaction,
      subscription: detectedPlanChange?.newName ?? subscription.name,
      ...(detectedPlanChange
        ? {
            planChangeDetected: true,
            previousName: detectedPlanChange.previousName,
            newPlan: detectedPlanChange.label,
          }
        : {}),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    console.error("Subscription Payment Webhook Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
