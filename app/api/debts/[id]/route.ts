import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

const DEBT_TYPES = ['credit', 'pret_immo', 'pret_perso', 'autre'];

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;
    const body = await req.json();
    const {
      name,
      type,
      lender,
      principal,
      currentBalance,
      interestRate,
      monthlyPayment,
      dueDay,
      startDate,
      endDate,
      isActive,
    } = body;

    const existing = await prisma.debt.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Dette introuvable' }, { status: 404 });
    }

    if (type !== undefined && type !== null && !DEBT_TYPES.includes(type)) {
      return NextResponse.json({ success: false, error: 'Type de dette invalide' }, { status: 400 });
    }

    let resolvedDueDay: number | null | undefined;
    if (dueDay !== undefined) {
      if (dueDay === null || dueDay === '') {
        resolvedDueDay = null;
      } else {
        const numeric = Number(dueDay);
        if (!Number.isInteger(numeric) || numeric < 1 || numeric > 31) {
          return NextResponse.json({ success: false, error: "Jour d'échéance invalide (1-31)" }, { status: 400 });
        }
        resolvedDueDay = numeric;
      }
    }

    const debt = await prisma.debt.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name) }),
        ...(type !== undefined && { type: type || 'autre' }),
        ...(lender !== undefined && { lender: lender || null }),
        ...(principal !== undefined && { principal: Number(principal) }),
        ...(currentBalance !== undefined && { currentBalance: Number(currentBalance) }),
        ...(interestRate !== undefined && { interestRate: Number(interestRate) || 0 }),
        ...(monthlyPayment !== undefined && { monthlyPayment: Number(monthlyPayment) || 0 }),
        ...(resolvedDueDay !== undefined && { dueDay: resolvedDueDay }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });

    return NextResponse.json({ success: true, data: debt });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Debts PUT Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;

    const existing = await prisma.debt.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Dette introuvable' }, { status: 404 });
    }

    // Les DebtPayment n'ont pas de sens sans leur dette — supprimés avec
    // elle. Les Transactions réelles qu'ils référencent (optionnel) restent
    // intactes, juste plus liées à un DebtPayment (FK ON DELETE SET NULL).
    await prisma.$transaction([
      prisma.debtPayment.deleteMany({ where: { debtId: id } }),
      prisma.debt.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Debts DELETE Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
