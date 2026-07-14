import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { userId } = await requireSession();
    const { fromAccountId, toAccountId, amount } = await request.json();

    if (!fromAccountId || !toAccountId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid transfer details' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const fromAccount = await tx.account.findFirst({
        where: { id: fromAccountId, userId },
      });

      if (!fromAccount) {
        throw new Error('Source account not found');
      }

      if (fromAccount.balance < amount) {
        throw new Error('Insufficient funds');
      }

      const toAccount = await tx.account.findFirst({
        where: { id: toAccountId, userId },
      });

      if (!toAccount) {
        throw new Error('Destination account not found');
      }

      await tx.account.update({
        where: { id: fromAccountId },
        data: { balance: { decrement: amount } },
      });

      await tx.account.update({
        where: { id: toAccountId },
        data: { balance: { increment: amount } },
      });

      let category = await tx.category.findFirst({
        where: { userId, name: 'Transfer' },
      });

      if (!category) {
        category = await tx.category.create({
          data: { userId, name: 'Transfer', type: 'transfer' },
        });
      }

      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId: fromAccountId,
          categoryId: category.id,
          merchant: `Transfer to ${toAccount.name}`,
          amount: -amount,
          date: new Date(),
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          accountId: toAccountId,
          categoryId: category.id,
          merchant: `Transfer from ${fromAccount.name}`,
          amount: amount,
          date: new Date(),
        },
      });

      return transaction;
    });

    return NextResponse.json({ success: true, transaction: result });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Transfer Engine Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status = message === 'Insufficient funds' ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
