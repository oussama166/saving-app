import { NextResponse } from "next/server";
import { getMonthlyAnalytics } from "@/lib/financials";
import { requireSession } from "@/lib/auth";
import { getHouseholdContext } from "@/lib/household";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await requireSession();
    const ctx = await getHouseholdContext(userId);
    const data = await getMonthlyAnalytics(ctx, 6);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
    }
    console.error("Monthly Analytics Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
