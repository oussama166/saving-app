import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyRefresh } from '@/lib/sse';
import { requireSession } from '@/lib/auth';
import { getTransactionsPage } from '@/lib/transactions';
import { checkAndSendBudgetAlert } from '@/lib/budgetAlerts';
import { getHouseholdContext, getHouseholdMemberIds } from '@/lib/household';

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const body = await req.json();
    const { date, type, categoryId, subCategory, paymentMethod, notes, amount } = body;
    const ctx = await getHouseholdContext(userId);

    // Vérifie que la catégorie appartient bien au foyer (propriétaire budget)
    // avant de l'utiliser — sans ce contrôle, un client pourrait référencer
    // l'ID de catégorie d'un autre utilisateur (tenant croisé).
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId: ctx.budgetOwnerId } });
    if (!category) {
      return NextResponse.json({ success: false, error: 'Catégorie invalide' }, { status: 400 });
    }

    const adjustedAmount = type === 'expense' ? -Math.abs(Number(amount)) : Math.abs(Number(amount));

    let account = await prisma.account.findFirst({
      where: { userId: { in: ctx.memberIds }, name: 'Main Checking' },
    });

    if (!account) {
      account = await prisma.account.create({
        data: { userId, name: 'Main Checking', type: 'checking', balance: 0 },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId: account!.id,
          categoryId: categoryId,
          subCategory: subCategory || null,
          paymentMethod: paymentMethod || null,
          merchant: notes || 'Manual Entry',
          amount: adjustedAmount,
          date: new Date(date),
        },
      });

      await tx.account.update({
        where: { id: account!.id },
        data: { balance: { increment: adjustedAmount } },
      });

      return transaction;
    });

    notifyRefresh();

    // Après coup, jamais bloquant (voir lib/budgetAlerts.ts) — ne concerne
    // que les dépenses, une entrée revenu/épargne n'a pas de budget associé.
    if (type === 'expense') {
      await checkAndSendBudgetAlert(userId, categoryId, new Date(date));
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Manual Transaction Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { userId } = await requireSession();
    const { searchParams } = new URL(req.url);
    const memberIds = await getHouseholdMemberIds(userId);

    const typeParam = searchParams.get('type');
    const type = typeParam === 'income' || typeParam === 'expense' || typeParam === 'savings' ? typeParam : undefined;
    const sortByParam = searchParams.get('sortBy');
    const sortBy = sortByParam === 'amount' ? 'amount' : 'date';
    const sortDirParam = searchParams.get('sortDir');
    const sortDir = sortDirParam === 'asc' ? 'asc' : 'desc';

    const { transactions, total, summary } = await getTransactionsPage(memberIds, {
      search: searchParams.get('search') || undefined,
      type,
      categoryId: searchParams.get('categoryId') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      sortBy,
      sortDir,
      limit: Number(searchParams.get('limit')) || 50,
      offset: Number(searchParams.get('offset')) || 0,
    });

    return NextResponse.json({ success: true, data: transactions, total, summary });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
