import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { revokeSession } from '@/lib/sessionTracking';

// Révoque un appareil connecté (bouton "Déconnecter" dans SessionsCard).
// Effective au prochain chargement de page sur l'appareil visé (voir le
// check dans app/layout.tsx), pas instantanément — voir le commentaire en
// tête de lib/sessionTracking.ts pour le détail du compromis.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;

    const revoked = await revokeSession(userId, id);
    if (!revoked) {
      return NextResponse.json({ success: false, error: 'Session introuvable' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Sessions DELETE Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
