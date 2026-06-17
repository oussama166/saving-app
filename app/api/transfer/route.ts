import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { fromAccountId, toAccountId, amount } = await request.json();

    if (!fromAccountId || !toAccountId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid transfer details' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify 'fromAccount' has enough balance
      const fromAccount = await tx.account.findUnique({
        where: { id: fromAccountId },
      });

      if (!fromAccount) {
        throw new Error('Source account not found');
      }

      if (fromAccount.balance < amount) {
        throw new Error('Insufficient funds');
      }

      // Verify 'toAccount' exists
      const toAccount = await tx.account.findUnique({
        where: { id: toAccountId },
      });

      if (!toAccount) {
        throw new Error('Destination account not found');
      }

      // 2. Decrement the 'fromAccount' balance
      await tx.account.update({
        where: { id: fromAccountId },
        data: { balance: { decrement: amount } },
      });

      // 3. Increment the 'toAccount' balance
      await tx.account.update({
        where: { id: toAccountId },
        data: { balance: { increment: amount } },
      });

      // 4. Find or create 'Transfer' category
      let category = await tx.category.findFirst({
        where: { name: 'Transfer' },
      });

      if (!category) {
        category = await tx.category.create({
          data: { name: 'Transfer', type: 'transfer' },
        });
      }

      // 5. Log a Transaction record showing the movement
      const transaction = await tx.transaction.create({
        data: {
          accountId: fromAccountId,
          categoryId: category.id,
          merchant: `Transfer to ${toAccount.name}`,
          amount: -amount,
          date: new Date(),
        },
      });

      // Also log the credit side for the destination account
      await tx.transaction.create({
        data: {
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
  } catch (error: any) {
    console.error('Transfer Engine Error:', error);
    const status = error.message === 'Insufficient funds' ? 400 : 500;
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}
