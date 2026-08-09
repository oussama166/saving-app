import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { listActiveSessions } from '@/lib/sessionTracking';

// Liste des sessions actives (non révoquées) de l'utilisateur connecté —
// utilisé par SessionsCard (page Profil). Voir lib/sessionTracking.ts.
export async function GET() {
  try {
    const { userId, jti } = await requireSession();
    const sessions = await listActiveSessions(userId, jti);
    return NextResponse.json({ success: true, data: sessions });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Sessions GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
