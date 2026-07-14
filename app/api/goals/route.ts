import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { userId } = await requireSession();
    const goals = await prisma.savingsGoal.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    return NextResponse.json({ success: true, data: goals });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Goals GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const { name, emoji, targetAmount, currentAmount, monthlyContribution, autoAllocatePct } = await req.json();

    if (!name || !targetAmount) {
      return NextResponse.json({ success: false, error: 'Nom et montant cible requis' }, { status: 400 });
    }

    const goal = await prisma.savingsGoal.create({
      data: {
        userId,
        name: String(name),
        emoji: emoji || null,
        targetAmount: Number(targetAmount),
        currentAmount: Number(currentAmount) || 0,
        monthlyContribution: Number(monthlyContribution) || 0,
        autoAllocatePct: Number(autoAllocatePct) || 0,
      },
    });

    return NextResponse.json({ success: true, data: goal });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Goals POST Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
