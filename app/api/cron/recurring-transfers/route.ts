import { NextResponse } from "next/server";
import { runDueRecurringTransfers } from "@/lib/recurringTransfers";

export const dynamic = "force-dynamic";

/**
 * Exécute les virements automatiques récurrents dus aujourd'hui (voir
 * lib/recurringTransfers.ts). Même pattern que /api/cron/weekly-digest :
 * protégé par un header `x-recurring-transfers-secret` (pas la session
 * cookie — "/api/cron/" est exclu de la protection middleware, voir
 * middleware.ts), pensé pour être appelé une fois par jour par un job
 * planifié externe (cron-job.org, GitHub Actions...).
 */
export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-recurring-transfers-secret");
    if (!process.env.RECURRING_TRANSFERS_SECRET || secret !== process.env.RECURRING_TRANSFERS_SECRET) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const summary = await runDueRecurringTransfers();

    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error("Recurring Transfers Cron Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
