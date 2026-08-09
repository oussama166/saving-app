import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getHouseholdMemberIds } from '@/lib/household';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; expenseId: string }> },
) {
  try {
    const { userId } = await requireSession();
    const { id, expenseId } = await params;
    const memberIds = await getHouseholdMemberIds(userId);

    const budget = await prisma.travelBudget.findFirst({ where: { id, userId: { in: memberIds } } });
    if (!budget) {
      return NextResponse.json({ success: false, error: 'Budget voyage introuvable' }, { status: 404 });
    }

    const expense = await prisma.travelExpense.findFirst({ where: { id: expenseId, travelBudgetId: id } });
    if (!expense) {
      return NextResponse.json({ success: false, error: 'Dépense introuvable' }, { status: 404 });
    }

    await prisma.travelExpense.delete({ where: { id: expenseId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Travel Expense DELETE Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
