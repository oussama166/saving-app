import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

// Annule une invitation en attente — accessible à n'importe quel membre du
// foyer (droits égaux, voir lib/household.ts), pas seulement celui qui l'a
// envoyée.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;

    const membership = await prisma.householdMember.findUnique({ where: { userId } });
    if (!membership) {
      return NextResponse.json({ success: false, error: 'Tu ne fais partie d\'aucun foyer' }, { status: 400 });
    }

    const invite = await prisma.householdInvite.findFirst({
      where: { id, householdId: membership.householdId },
    });
    if (!invite) {
      return NextResponse.json({ success: false, error: 'Invitation introuvable' }, { status: 404 });
    }

    await prisma.householdInvite.update({ where: { id }, data: { status: 'cancelled' } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Household Invite Cancel Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
