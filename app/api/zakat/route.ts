import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { computeZakatableWealth } from "@/lib/zakat";

export async function GET() {
  try {
    const { userId } = await requireSession();
    const breakdown = await computeZakatableWealth(userId);
    return NextResponse.json({ success: true, data: breakdown });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
    }
    console.error("Zakat API Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
