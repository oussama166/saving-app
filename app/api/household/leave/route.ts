import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

// Quitter le foyer — avec un maximum de 2 membres, partir laisse toujours au
// plus 1 personne restante, donc le foyer entier est dissous (même logique
// que lib/deleteUserData.ts) plutôt que de laisser l'autre membre dans un
// foyer fantôme à 1 personne. Chacun récupère automatiquement son propre
// budget (Category/UserSettings jamais touchés pendant l'appartenance au
// foyer — voir lib/household.ts).
export async function POST() {
  try {
    const { userId } = await requireSession();

    const membership = await prisma.householdMember.findUnique({ where: { userId } });
    if (!membership) {
      return NextResponse.json({ success: false, error: 'Tu ne fais partie d\'aucun foyer' }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.householdInvite.deleteMany({ where: { householdId: membership.householdId } }),
      prisma.householdMember.deleteMany({ where: { householdId: membership.householdId } }),
      prisma.household.delete({ where: { id: membership.householdId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Household Leave Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
