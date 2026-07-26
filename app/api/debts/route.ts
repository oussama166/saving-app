import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getHouseholdContext } from '@/lib/household';
import { requireFeatureAccess } from '@/lib/features';

const DEBT_TYPES = ['credit', 'pret_immo', 'pret_perso', 'autre'];

export async function GET() {
  try {
    const { userId } = await requireSession();
    await requireFeatureAccess('debts', userId);
    const ctx = await getHouseholdContext(userId);

    const [debts, accounts] = await Promise.all([
      prisma.debt.findMany({
        where: { userId: { in: ctx.memberIds } },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
        include: { _count: { select: { payments: true } } },
      }),
      prisma.account.findMany({ where: { userId: { in: ctx.memberIds } }, orderBy: { createdAt: 'asc' } }),
    ]);

    const totalRemaining = debts.filter((d) => d.isActive).reduce((acc, d) => acc + d.currentBalance, 0);

    return NextResponse.json({
      success: true,
      data: debts.map((d) => ({
        ...d,
        paidOffPct: d.principal > 0 ? Math.round(((d.principal - d.currentBalance) / d.principal) * 100) : 0,
        paymentCount: d._count.payments,
        _count: undefined,
      })),
      totalRemaining,
      accounts: accounts.map((a) => ({ id: a.id, name: a.name })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'FEATURE_DISABLED') {
      return NextResponse.json({ success: false, error: 'Cette fonctionnalité est temporairement désactivée.' }, { status: 403 });
    }
    console.error('Debts GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const body = await req.json();
    const { name, type, lender, principal, currentBalance, interestRate, monthlyPayment, dueDay, startDate, endDate } =
      body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ success: false, error: 'Nom requis' }, { status: 400 });
    }
    const principalNum = Number(principal);
    if (!Number.isFinite(principalNum) || principalNum <= 0) {
      return NextResponse.json({ success: false, error: 'Montant emprunté invalide' }, { status: 400 });
    }
    const currentBalanceNum =
      currentBalance !== undefined && currentBalance !== null && currentBalance !== '' ? Number(currentBalance) : principalNum;
    if (!Number.isFinite(currentBalanceNum) || currentBalanceNum < 0) {
      return NextResponse.json({ success: false, error: 'Solde restant invalide' }, { status: 400 });
    }
    if (type !== undefined && type !== null && !DEBT_TYPES.includes(type)) {
      return NextResponse.json({ success: false, error: 'Type de dette invalide' }, { status: 400 });
    }
    let dueDayNum: number | undefined;
    if (dueDay !== undefined && dueDay !== null && dueDay !== '') {
      dueDayNum = Number(dueDay);
      if (!Number.isInteger(dueDayNum) || dueDayNum < 1 || dueDayNum > 31) {
        return NextResponse.json({ success: false, error: "Jour d'échéance invalide (1-31)" }, { status: 400 });
      }
    }

    const debt = await prisma.debt.create({
      data: {
        userId,
        name,
        type: type || 'autre',
        lender: lender || null,
        principal: principalNum,
        currentBalance: currentBalanceNum,
        interestRate: interestRate !== undefined ? Number(interestRate) || 0 : 0,
        monthlyPayment: monthlyPayment !== undefined ? Number(monthlyPayment) || 0 : 0,
        dueDay: dueDayNum ?? null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    return NextResponse.json({ success: true, data: debt });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Debts POST Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
