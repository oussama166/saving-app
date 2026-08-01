import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getHouseholdContext } from '@/lib/household';
import { requireFeatureAccess } from '@/lib/features';

export async function GET() {
  try {
    const { userId } = await requireSession();
    await requireFeatureAccess('calendar', userId);
    const ctx = await getHouseholdContext(userId);

    const [bills, categories] = await Promise.all([
      prisma.bill.findMany({
        where: { userId: { in: ctx.memberIds } },
        orderBy: [{ isActive: 'desc' }, { dayOfMonth: 'asc' }],
        include: { category: { select: { id: true, name: true } } },
      }),
      prisma.category.findMany({ where: { userId: ctx.budgetOwnerId, type: 'expense' }, orderBy: { order: 'asc' } }),
    ]);

    return NextResponse.json({
      success: true,
      data: bills,
      categories: categories.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'FEATURE_DISABLED') {
      return NextResponse.json({ success: false, error: 'Cette fonctionnalité est temporairement désactivée.' }, { status: 403 });
    }
    console.error('Bills GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    await requireFeatureAccess('calendar', userId);
    const ctx = await getHouseholdContext(userId);
    const body = await req.json();
    const { name, amount, dayOfMonth, categoryId } = body as {
      name?: string;
      amount?: number;
      dayOfMonth?: number;
      categoryId?: string | null;
    };

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Nom requis' }, { status: 400 });
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Montant invalide' }, { status: 400 });
    }
    const numericDay = Number(dayOfMonth);
    if (!Number.isInteger(numericDay) || numericDay < 1 || numericDay > 28) {
      return NextResponse.json({ success: false, error: 'Jour du mois invalide (1-28)' }, { status: 400 });
    }

    if (categoryId) {
      const category = await prisma.category.findFirst({ where: { id: categoryId, userId: ctx.budgetOwnerId } });
      if (!category) {
        return NextResponse.json({ success: false, error: 'Catégorie invalide' }, { status: 400 });
      }
    }

    const bill = await prisma.bill.create({
      data: {
        userId,
        name: name.trim(),
        amount: numericAmount,
        dayOfMonth: numericDay,
        categoryId: categoryId || null,
      },
    });

    return NextResponse.json({ success: true, data: bill });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Bills POST Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
