import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

// Historique des changements de plan/prix détectés automatiquement par
// /api/webhook/subscription-payment pour un abonnement donné (voir
// prisma/schema.prisma -> SubscriptionPlanChange). Affiché dans la page
// Abonnements.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;

    const subscription = await prisma.subscription.findFirst({ where: { id, userId } });
    if (!subscription) {
      return NextResponse.json({ success: false, error: "Abonnement introuvable" }, { status: 404 });
    }

    const changes = await prisma.subscriptionPlanChange.findMany({
      where: { subscriptionId: id },
      orderBy: { changedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: changes.map((c) => ({
        id: c.id,
        previousName: c.previousName,
        newName: c.newName,
        previousPrice: c.previousPrice,
        newPrice: c.newPrice,
        changedAt: c.changedAt,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
    }
    console.error("Subscription Plan History GET Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
