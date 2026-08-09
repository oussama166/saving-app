import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getHouseholdMemberIds } from '@/lib/household';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;
    const body = await req.json();
    const { merchant, amount, date, note } = body as {
      merchant?: string;
      amount?: number;
      date?: string | null;
      note?: string | null;
    };

    const memberIds = await getHouseholdMemberIds(userId);
    const budget = await prisma.travelBudget.findFirst({ where: { id, userId: { in: memberIds } } });
    if (!budget) {
      return NextResponse.json({ success: false, error: 'Budget voyage introuvable' }, { status: 404 });
    }

    if (!merchant || !merchant.trim()) {
      return NextResponse.json({ success: false, error: 'Marchand/description requis' }, { status: 400 });
    }
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json({ success: false, error: 'Montant invalide' }, { status: 400 });
    }

    const expense = await prisma.travelExpense.create({
      data: {
        travelBudgetId: id,
        userId,
        merchant: merchant.trim(),
        amount: amountNum,
        date: date ? new Date(date) : new Date(),
        note: note || null,
      },
    });

    return NextResponse.json({ success: true, data: expense });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Travel Expense POST Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
