import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;
    const { name, emoji, targetAmount, currentAmount, monthlyContribution, autoAllocatePct } = await req.json();

    const existing = await prisma.savingsGoal.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Objectif introuvable' }, { status: 404 });
    }

    const goal = await prisma.savingsGoal.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name) }),
        ...(emoji !== undefined && { emoji: emoji || null }),
        ...(targetAmount !== undefined && { targetAmount: Number(targetAmount) }),
        ...(currentAmount !== undefined && { currentAmount: Number(currentAmount) }),
        ...(monthlyContribution !== undefined && { monthlyContribution: Number(monthlyContribution) }),
        ...(autoAllocatePct !== undefined && { autoAllocatePct: Number(autoAllocatePct) }),
      },
    });

    return NextResponse.json({ success: true, data: goal });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Goals PUT Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;

    const existing = await prisma.savingsGoal.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Objectif introuvable' }, { status: 404 });
    }

    await prisma.savingsGoal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Goals DELETE Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
