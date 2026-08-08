import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getHouseholdContext } from "@/lib/household";
import { requireFeatureAccess } from "@/lib/features";
import { getNetWorthHistory } from "@/lib/netWorthHistory";

// Historique du patrimoine net pour le graphique du dashboard (voir
// lib/netWorthHistory.ts) — endpoint léger séparé de GET /api/dashboard
// (qui, lui, capture le point du jour) pour ne pas alourdir la réponse
// principale à chaque poll SSE/60s.
export async function GET(req: Request) {
  try {
    const { userId } = await requireSession();
    await requireFeatureAccess("dashboard", userId);
    const ctx = await getHouseholdContext(userId);

    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get("days")) || 180;

    const history = await getNetWorthHistory(ctx, days);

    return NextResponse.json({ success: true, data: history });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FEATURE_DISABLED") {
      return NextResponse.json({ success: false, error: "Cette fonctionnalité est temporairement désactivée." }, { status: 403 });
    }
    console.error("Net Worth History GET Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
