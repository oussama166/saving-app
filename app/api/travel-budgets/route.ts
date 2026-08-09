import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getHouseholdContext } from '@/lib/household';
import { requireFeatureAccess } from '@/lib/features';

export async function GET() {
  try {
    const { userId } = await requireSession();
    await requireFeatureAccess('travel_budget', userId);
    const ctx = await getHouseholdContext(userId);

    const budgets = await prisma.travelBudget.findMany({
      where: { userId: { in: ctx.memberIds } },
      include: { expenses: { orderBy: { date: 'desc' } } },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });

    const data = budgets.map((b) => {
      const spent = b.expenses.reduce((acc, e) => acc + e.amount, 0);
      return {
        id: b.id,
        name: b.name,
        currency: b.currency,
        budgetAmount: b.budgetAmount,
        startDate: b.startDate?.toISOString() ?? null,
        endDate: b.endDate?.toISOString() ?? null,
        isActive: b.isActive,
        spent,
        remaining: b.budgetAmount - spent,
        expenseCount: b.expenses.length,
        expenses: b.expenses.map((e) => ({
          id: e.id,
          merchant: e.merchant,
          amount: e.amount,
          date: e.date.toISOString(),
          note: e.note,
        })),
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'FEATURE_DISABLED') {
      return NextResponse.json({ success: false, error: 'Cette fonctionnalité est temporairement désactivée.' }, { status: 403 });
    }
    console.error('Travel Budgets GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const body = await req.json();
    const { name, currency, budgetAmount, startDate, endDate } = body as {
      name?: string;
      currency?: string;
      budgetAmount?: number;
      startDate?: string | null;
      endDate?: string | null;
    };

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Nom requis' }, { status: 400 });
    }
    if (!currency || !currency.trim()) {
      return NextResponse.json({ success: false, error: 'Devise requise' }, { status: 400 });
    }
    const amountNum = Number(budgetAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json({ success: false, error: 'Montant invalide' }, { status: 400 });
    }

    const budget = await prisma.travelBudget.create({
      data: {
        userId,
        name: name.trim(),
        currency: currency.trim().toUpperCase(),
        budgetAmount: amountNum,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    return NextResponse.json({ success: true, data: budget });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Travel Budgets POST Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
