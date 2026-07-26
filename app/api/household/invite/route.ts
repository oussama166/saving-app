import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { generateSecureToken } from '@/lib/tokens';
import { sendHouseholdInviteEmail } from '@/lib/email';
import { MAX_HOUSEHOLD_MEMBERS } from '@/lib/household';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

// Crée le foyer au premier envoi si l'utilisateur n'en a pas encore (il en
// devient le propriétaire budget — voir lib/household.ts), puis émet une
// invitation par email. Un foyer plein (2 membres) ne peut pas inviter de
// plus — cohérent avec le choix "2 personnes max" pour ce v1.
export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const { email } = (await req.json()) as { email?: string };

    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      return NextResponse.json({ success: false, error: 'Adresse email invalide' }, { status: 400 });
    }

    const inviter = await prisma.user.findUnique({ where: { id: userId } });
    if (!inviter) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    if (normalizedEmail === inviter.email.toLowerCase()) {
      return NextResponse.json({ success: false, error: 'Tu ne peux pas t\'inviter toi-même' }, { status: 400 });
    }

    const membership = await prisma.householdMember.findUnique({
      where: { userId },
      include: { household: { include: { members: true, invites: { where: { status: 'pending' } } } } },
    });

    if (membership) {
      const totalCommitted = membership.household.members.length + membership.household.invites.length;
      if (totalCommitted >= MAX_HOUSEHOLD_MEMBERS) {
        return NextResponse.json(
          { success: false, error: 'Ton foyer est déjà complet (2 personnes maximum).' },
          { status: 400 },
        );
      }
    }

    let householdId: string;
    if (membership) {
      householdId = membership.householdId;
    } else {
      const household = await prisma.household.create({
        data: { members: { create: { userId, isBudgetOwner: true } } },
      });
      householdId = household.id;
    }

    // Un email déjà associé à un compte qui est déjà dans CE foyer, ou une
    // invitation déjà en attente pour cette adresse dans ce foyer : évite le
    // spam d'invitations en double plutôt que d'empiler des lignes inutiles.
    const existingInvite = await prisma.householdInvite.findFirst({
      where: { householdId, email: normalizedEmail, status: 'pending' },
    });
    if (existingInvite) {
      return NextResponse.json(
        { success: false, error: 'Une invitation est déjà en attente pour cette adresse.' },
        { status: 400 },
      );
    }

    const token = generateSecureToken();
    await prisma.householdInvite.create({
      data: {
        householdId,
        invitedByUserId: userId,
        email: normalizedEmail,
        token,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });

    await sendHouseholdInviteEmail(normalizedEmail, { inviterName: inviter.name || inviter.email, token });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Household Invite Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
