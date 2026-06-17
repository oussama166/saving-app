import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { amount } = await req.json();

    // 1. Update Main Checking balance
    let account = await prisma.account.findFirst({
      where: { name: 'Main Checking' },
    });

    if (!account) {
      account = await prisma.account.create({
        data: { name: 'Main Checking', type: 'checking', balance: amount },
      });
    } else {
      await prisma.account.update({
        where: { id: account.id },
        data: { balance: { increment: amount } },
      });
    }

    // 2. Query all Savings Goals for auto-allocation
    const savingsGoals = await prisma.savingsGoal.findMany({
      where: { autoAllocatePct: { gt: 0 } },
    });

    const updates = savingsGoals.map((goal) => {
      const allocation = amount * (goal.autoAllocatePct / 100);
      return prisma.savingsGoal.update({
        where: { id: goal.id },
        data: { currentAmount: { increment: allocation } },
      });
    });

    if (updates.length > 0) {
      await prisma.$transaction(updates);
    }

    return NextResponse.json({ success: true, allocated: updates.length });
  } catch (error) {
    console.error('Salary Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
