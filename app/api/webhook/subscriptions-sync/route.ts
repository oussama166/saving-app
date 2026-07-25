import { NextResponse } from "next/server";
import { requireWebhookAuth } from "@/lib/webhookAuth";
import { catchUpSubscriptionCharges } from "@/lib/subscriptions";

// "Sauvegarde en une fois" des abonnements du mois : déclenche manuellement
// le même rattrapage (catch-up) qui tourne déjà silencieusement à chaque
// chargement de la page Abonnements/du dashboard (voir lib/subscriptions.ts)
// — utile pour un Shortcut iOS déclenché une fois par mois, ou pour forcer
// la synchronisation sans ouvrir l'app. Idempotent : rejouer plusieurs fois
// dans le même mois ne crée pas de doublons (lastChargedYearMonth empêche
// une double charge par abonnement).
export async function POST(req: Request) {
  try {
    const { userId } = await requireWebhookAuth(req);

    const created = await catchUpSubscriptionCharges(userId);

    return NextResponse.json({
      success: true,
      created,
      message:
        created > 0
          ? `${created} prélèvement(s) d'abonnement enregistré(s).`
          : "Rien à faire — tous les abonnements actifs sont déjà à jour pour ce mois.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    console.error("Subscriptions Sync Webhook Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
