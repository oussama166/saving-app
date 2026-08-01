import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getHouseholdContext, getHouseholdMemberIds } from '@/lib/household';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;
    const body = await req.json();
    const { name, amount, dayOfMonth, categoryId, isActive } = body as {
      name?: string;
      amount?: number;
      dayOfMonth?: number;
      categoryId?: string | null;
      isActive?: boolean;
    };

    const ctx = await getHouseholdContext(userId);
    const existing = await prisma.bill.findFirst({ where: { id, userId: { in: ctx.memberIds } } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Facture introuvable' }, { status: 404 });
    }

    if (amount !== undefined && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)) {
      return NextResponse.json({ success: false, error: 'Montant invalide' }, { status: 400 });
    }
    if (dayOfMonth !== undefined) {
      const numericDay = Number(dayOfMonth);
      if (!Number.isInteger(numericDay) || numericDay < 1 || numericDay > 28) {
        return NextResponse.json({ success: false, error: 'Jour du mois invalide (1-28)' }, { status: 400 });
      }
    }
    if (categoryId) {
      const category = await prisma.category.findFirst({ where: { id: categoryId, userId: ctx.budgetOwnerId } });
      if (!category) {
        return NextResponse.json({ success: false, error: 'Catégorie invalide' }, { status: 400 });
      }
    }

    const bill = await prisma.bill.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(amount !== undefined && { amount: Number(amount) }),
        ...(dayOfMonth !== undefined && { dayOfMonth: Number(dayOfMonth) }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });

    return NextResponse.json({ success: true, data: bill });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Bills PATCH Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;
    const memberIds = await getHouseholdMemberIds(userId);

    const existing = await prisma.bill.findFirst({ where: { id, userId: { in: memberIds } } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Facture introuvable' }, { status: 404 });
    }

    await prisma.bill.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Bills DELETE Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
