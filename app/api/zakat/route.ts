import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { computeZakatableWealth } from "@/lib/zakat";
import { requireFeatureAccess } from "@/lib/features";

export async function GET() {
  try {
    const { userId } = await requireSession();
    await requireFeatureAccess("zakat", userId);
    const breakdown = await computeZakatableWealth(userId);
    return NextResponse.json({ success: true, data: breakdown });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FEATURE_DISABLED") {
      return NextResponse.json({ success: false, error: "Cette fonctionnalité est temporairement désactivée." }, { status: 403 });
    }
    console.error("Zakat API Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
