import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { generateWebhookToken } from '@/lib/webhookAuth';

export const dynamic = 'force-dynamic';

// Retourne le token de webhook actuel de l'utilisateur (null s'il n'en a
// jamais généré). Toujours protégé par la session navigateur classique :
// seule l'app elle-même (utilisateur connecté) peut consulter/régénérer son
// propre token.
export async function GET() {
  try {
    const { userId } = await requireSession();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { webhookToken: true },
    });
    return NextResponse.json({ success: true, data: { webhookToken: user?.webhookToken ?? null } });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Webhook Token GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

// Génère (ou régénère) le token de webhook — invalide l'ancien
// automatiquement puisqu'il est remplacé en base.
export async function POST() {
  try {
    const { userId } = await requireSession();
    const webhookToken = generateWebhookToken();
    await prisma.user.update({ where: { id: userId }, data: { webhookToken } });
    return NextResponse.json({ success: true, data: { webhookToken } });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Webhook Token POST Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

// Révoque le token (le remet à null) — coupe l'accès webhook externe sans
// supprimer le compte.
export async function DELETE() {
  try {
    const { userId } = await requireSession();
    await prisma.user.update({ where: { id: userId }, data: { webhookToken: null } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Webhook Token DELETE Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
