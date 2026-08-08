import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

// Supprime l'abonnement push de cet appareil (bouton "Désactiver" côté UI).
// Filtré par userId en plus de endpoint : évite qu'un utilisateur supprime
// l'abonnement d'un autre en devinant/rejouant un endpoint.
export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const body = await req.json();
    const { endpoint } = body ?? {};

    if (!endpoint) {
      return NextResponse.json({ success: false, error: 'endpoint requis' }, { status: 400 });
    }

    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Push Unsubscribe Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
