import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { addManualContribution } from '@/lib/goalContributions';
import { getHouseholdMemberIds } from '@/lib/household';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;
    const memberIds = await getHouseholdMemberIds(userId);

    const goal = await prisma.savingsGoal.findFirst({ where: { id, userId: { in: memberIds } } });
    if (!goal) {
      return NextResponse.json({ success: false, error: 'Objectif introuvable' }, { status: 404 });
    }

    const contributions = await prisma.goalContribution.findMany({
      where: { goalId: id },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ success: true, data: contributions });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Goal Contributions GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;
    const { amount, date, note } = await req.json();
    const memberIds = await getHouseholdMemberIds(userId);

    const goal = await prisma.savingsGoal.findFirst({ where: { id, userId: { in: memberIds } } });
    if (!goal) {
      return NextResponse.json({ success: false, error: 'Objectif introuvable' }, { status: 404 });
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Montant invalide' }, { status: 400 });
    }

    await addManualContribution({
      userId,
      goalId: id,
      amount: numericAmount,
      date: date ? new Date(date) : undefined,
      note: note || null,
      isAutomatic: false,
    });

    const updated = await prisma.savingsGoal.findUnique({ where: { id } });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Goal Contributions POST Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
