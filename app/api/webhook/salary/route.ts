import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWebhookAuth } from '@/lib/webhookAuth';

// Accepte soit un token de webhook dédié (header `Authorization: Bearer
// <token>`, généré depuis la page Profil), soit le cookie de session
// classique (appel depuis l'app elle-même).
export async function POST(req: Request) {
  try {
    const { userId } = await requireWebhookAuth(req);
    const { amount } = await req.json();

    let account = await prisma.account.findFirst({
      where: { userId, name: 'Main Checking' },
    });

    if (!account) {
      account = await prisma.account.create({
        data: { userId, name: 'Main Checking', type: 'checking', balance: amount },
      });
    } else {
      await prisma.account.update({
        where: { id: account.id },
        data: { balance: { increment: amount } },
      });
    }

    const savingsGoals = await prisma.savingsGoal.findMany({
      where: { userId, autoAllocatePct: { gt: 0 } },
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
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Salary Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
