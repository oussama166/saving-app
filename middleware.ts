import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { SESSION_COOKIE } from '@/lib/auth';

// Pages accessibles sans être connecté.
const PUBLIC_PATHS = ['/login', '/signup'];
// Préfixes d'API accessibles sans session cookie : l'inscription/connexion
// elles-mêmes, et l'archivage planifié (protégé par son propre header
// `x-backup-secret`, pensé pour être appelé par un job externe sans session
// navigateur — voir app/api/backup/archive/route.ts).
const PUBLIC_API_PREFIXES = ['/api/auth/', '/api/backup/'];

async function isValidSession(token: string | undefined) {
  if (!token) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const authenticated = await isValidSession(token);
  const isPublicPage = PUBLIC_PATHS.includes(pathname);

  if (isPublicPage) {
    // Un utilisateur déjà connecté n'a pas besoin de revoir /login ou /signup.
    if (authenticated) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  if (!authenticated) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
