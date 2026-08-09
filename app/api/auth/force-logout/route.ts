import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';

// Cible du redirect depuis app/layout.tsx quand une session a été révoquée
// (bouton "déconnecter cet appareil" actionné depuis un autre appareil, voir
// lib/sessionTracking.ts). Un Server Component ne peut pas poser de cookie
// pendant son rendu — seul un Route Handler/Server Action le peut — d'où ce
// petit détour : efface le cookie de session puis renvoie vers /login.
export async function GET(req: Request) {
  const response = NextResponse.redirect(new URL('/login', req.url));
  response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
