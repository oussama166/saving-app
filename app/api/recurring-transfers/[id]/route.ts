import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getHouseholdContext } from '@/lib/household';

// Active/désactive une règle (voir bouton toggle dans RecurringTransfersCard)
// — désactiver plutôt que supprimer garde l'historique (lastRunAt/lastRunCycle)
// si l'utilisateur veut la réactiver plus tard.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;
    const { active } = (await req.json()) as { active?: boolean };

    if (typeof active !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Champ "active" requis' }, { status: 400 });
    }

    const ctx = await getHouseholdContext(userId);
    const existing = await prisma.recurringTransfer.findFirst({ where: { id, userId: ctx.budgetOwnerId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Règle introuvable' }, { status: 404 });
    }

    const rule = await prisma.recurringTransfer.update({ where: { id }, data: { active } });
    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Recurring Transfer PATCH Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;

    const ctx = await getHouseholdContext(userId);
    const existing = await prisma.recurringTransfer.findFirst({ where: { id, userId: ctx.budgetOwnerId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Règle introuvable' }, { status: 404 });
    }

    await prisma.recurringTransfer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Recurring Transfer DELETE Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
