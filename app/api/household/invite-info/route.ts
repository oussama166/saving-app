import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Lecture publique (pas de session requise, voir middleware.ts) — juste de
// quoi afficher "X t'invite" sur /household/accept avant que le visiteur ne
// soit connecté. Aucune donnée sensible : nom de l'invitant + email de la
// personne invitée (déjà connu du visiteur puisque c'est lui qui a reçu
// l'email).
export async function GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get('token');
    if (!token) {
      return NextResponse.json({ success: false, error: 'Jeton requis' }, { status: 400 });
    }

    const invite = await prisma.householdInvite.findUnique({
      where: { token },
      include: { invitedBy: { select: { name: true, email: true } } },
    });

    if (!invite) {
      return NextResponse.json({ success: false, error: 'Invitation introuvable' }, { status: 404 });
    }

    const valid = invite.status === 'pending' && invite.expiresAt > new Date();

    return NextResponse.json({
      success: true,
      data: {
        valid,
        status: invite.status,
        inviterName: invite.invitedBy.name || invite.invitedBy.email,
        email: invite.email,
      },
    });
  } catch (error) {
    console.error('Household Invite Info Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
