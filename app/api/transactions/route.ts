import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyRefresh } from '@/lib/sse';
import { requireSession } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const body = await req.json();
    const { date, type, categoryId, subCategory, paymentMethod, notes, amount } = body;

    // Vérifie que la catégorie appartient bien à l'utilisateur avant de
    // l'utiliser — sans ce contrôle, un client pourrait référencer l'ID
    // de catégorie d'un autre utilisateur (tenant croisé).
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) {
      return NextResponse.json({ success: false, error: 'Catégorie invalide' }, { status: 400 });
    }

    const adjustedAmount = type === 'expense' ? -Math.abs(Number(amount)) : Math.abs(Number(amount));

    let account = await prisma.account.findFirst({
      where: { userId, name: 'Main Checking' },
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

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Manual Transaction Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { userId } = await requireSession();
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      take: 50,
      orderBy: { date: 'desc' },
      include: {
        category: true,
        account: true,
      },
    });
    return NextResponse.json({ success: true, data: transactions });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
