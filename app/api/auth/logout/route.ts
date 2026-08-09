import { NextResponse } from 'next/server';
import { getSession, SESSION_COOKIE } from '@/lib/auth';
import { deleteSessionRecord } from '@/lib/sessionTracking';

export async function POST() {
  // Nettoyage best-effort de la ligne Session (voir lib/sessionTracking.ts)
  // — jamais bloquant : le cookie est de toute façon effacé juste après,
  // donc la déconnexion réussit même si ce nettoyage échoue.
  const session = await getSession();
  if (session?.jti) await deleteSessionRecord(session.jti);

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
