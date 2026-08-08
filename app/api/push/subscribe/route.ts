import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

// Enregistre l'abonnement PushSubscription (endpoint + clés) renvoyé par
// navigator.serviceWorker.ready → pushManager.subscribe() côté client (voir
// app/components/PushNotificationCard.tsx). upsert sur endpoint (unique
// globalement côté navigateur) : un ré-abonnement du même appareil met à
// jour les clés plutôt que de créer un doublon.
export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const body = await req.json();
    const { endpoint, keys } = body ?? {};

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ success: false, error: 'Abonnement push invalide' }, { status: 400 });
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId, p256dh: keys.p256dh, auth: keys.auth },
      create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Push Subscribe Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
