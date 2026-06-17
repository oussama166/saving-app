import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyRefresh } from '@/lib/sse';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, type, categoryId, subCategory, paymentMethod, notes, amount } = body;

    const adjustedAmount = type === 'expense' ? -Math.abs(Number(amount)) : Math.abs(Number(amount));

    let account = await prisma.account.findFirst({
      where: { name: 'Main Checking' },
    });

    if (!account) {
      account = await prisma.account.create({
        data: { name: 'Main Checking', type: 'checking', balance: 0 },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
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
    console.error('Manual Transaction Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const transactions = await prisma.transaction.findMany({
      take: 50,
      orderBy: { date: 'desc' },
      include: {
        category: true,
        account: true,
      },
    });
    return NextResponse.json({ success: true, data: transactions });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
