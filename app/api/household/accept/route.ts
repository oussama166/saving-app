import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { MAX_HOUSEHOLD_MEMBERS } from '@/lib/household';

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const { token } = (await req.json()) as { token?: string };

    if (!token) {
      return NextResponse.json({ success: false, error: 'Jeton requis' }, { status: 400 });
    }

    const invite = await prisma.householdInvite.findUnique({
      where: { token },
      include: { household: { include: { members: true } } },
    });

    if (!invite || invite.status !== 'pending') {
      return NextResponse.json({ success: false, error: 'Invitation invalide ou déjà utilisée' }, { status: 400 });
    }
    if (invite.expiresAt < new Date()) {
      await prisma.householdInvite.update({ where: { id: invite.id }, data: { status: 'expired' } });
      return NextResponse.json({ success: false, error: 'Cette invitation a expiré' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    // L'invitation cible une adresse précise — seul le compte connecté avec
    // cette adresse peut l'accepter, même si le jeton fuite ailleurs.
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: `Cette invitation est destinée à ${invite.email}, pas à ton compte.` },
        { status: 403 },
      );
    }

    const existingMembership = await prisma.householdMember.findUnique({ where: { userId } });
    if (existingMembership) {
      return NextResponse.json(
        { success: false, error: 'Tu fais déjà partie d\'un foyer — quitte-le avant d\'en rejoindre un autre.' },
        { status: 400 },
      );
    }

    if (invite.household.members.length >= MAX_HOUSEHOLD_MEMBERS) {
      return NextResponse.json({ success: false, error: 'Ce foyer est déjà complet.' }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.householdMember.create({
        data: { householdId: invite.householdId, userId, isBudgetOwner: false },
      }),
      prisma.householdInvite.update({ where: { id: invite.id }, data: { status: 'accepted' } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Household Accept Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
