import { NextResponse } from "next/server";
import { sendDueSubscriptionReminders } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

/**
 * Envoie un rappel email 2 à 5 jours avant le prochain prélèvement de chaque
 * abonnement actif (voir lib/subscriptions.ts::sendDueSubscriptionReminders).
 * Même pattern que /api/cron/weekly-digest : protégé par un header
 * `x-cron-secret` (pas la session cookie, exclu de la protection
 * middleware — voir middleware.ts), pensé pour un job planifié externe
 * (cron-job.org...) appelé une fois par jour. Vercel Hobby ne garantit pas
 * de cron interne fiable en continu.
 */
export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-cron-secret");
    if (!process.env.SUBSCRIPTION_REMINDERS_SECRET || secret !== process.env.SUBSCRIPTION_REMINDERS_SECRET) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { sent, skipped } = await sendDueSubscriptionReminders();

    return NextResponse.json({ success: true, sent, skipped });
  } catch (error) {
    console.error("Subscription Reminders Cron Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
