import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getHouseholdContext } from '@/lib/household';

export async function POST(request: Request) {
  try {
    const { userId } = await requireSession();
    const { fromAccountId, toAccountId, amount } = await request.json();
    const ctx = await getHouseholdContext(userId);

    if (!fromAccountId || !toAccountId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid transfer details' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const fromAccount = await tx.account.findFirst({
        where: { id: fromAccountId, userId: { in: ctx.memberIds } },
      });

      if (!fromAccount) {
        throw new Error('Source account not found');
      }

      if (fromAccount.balance < amount) {
        throw new Error('Insufficient funds');
      }

      const toAccount = await tx.account.findFirst({
        where: { id: toAccountId, userId: { in: ctx.memberIds } },
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
        where: { userId: ctx.budgetOwnerId, name: 'Transfer' },
      });

      if (!category) {
        category = await tx.category.create({
          data: { userId: ctx.budgetOwnerId, name: 'Transfer', type: 'transfer' },
        });
      }

      const transaction = await tx.transaction.create({
        data: {
          // Attribuée au propriétaire réel du compte débité, pas forcément
          // la personne qui déclenche le virement (voir lib/household.ts).
          userId: fromAccount.userId,
          accountId: fromAccountId,
          categoryId: category.id,
          merchant: `Transfer to ${toAccount.name}`,
          amount: -amount,
          date: new Date(),
        },
      });

      await tx.transaction.create({
        data: {
          userId: toAccount.userId,
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
