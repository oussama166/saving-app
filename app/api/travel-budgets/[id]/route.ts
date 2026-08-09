import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getHouseholdMemberIds } from '@/lib/household';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;
    const body = await req.json();
    const { name, currency, budgetAmount, startDate, endDate, isActive } = body as {
      name?: string;
      currency?: string;
      budgetAmount?: number;
      startDate?: string | null;
      endDate?: string | null;
      isActive?: boolean;
    };

    const memberIds = await getHouseholdMemberIds(userId);
    const existing = await prisma.travelBudget.findFirst({ where: { id, userId: { in: memberIds } } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Budget voyage introuvable' }, { status: 404 });
    }

    const budget = await prisma.travelBudget.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(currency !== undefined && { currency: String(currency).trim().toUpperCase() }),
        ...(budgetAmount !== undefined && { budgetAmount: Number(budgetAmount) }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });

    return NextResponse.json({ success: true, data: budget });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Travel Budget PUT Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;
    const memberIds = await getHouseholdMemberIds(userId);

    const existing = await prisma.travelBudget.findFirst({ where: { id, userId: { in: memberIds } } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Budget voyage introuvable' }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.travelExpense.deleteMany({ where: { travelBudgetId: id } }),
      prisma.travelBudget.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Travel Budget DELETE Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
