import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth';
import { createAdminSessionToken, ADMIN_SESSION_COOKIE, ADMIN_SESSION_COOKIE_OPTIONS } from '@/lib/adminAuth';
import { getRateLimitKey, isRateLimited, recordFailedAttempt, clearAttempts } from '@/lib/rateLimit';

// Même protection anti brute-force que /api/auth/login (voir lib/rateLimit.ts),
// avec une clé préfixée "admin:" pour ne jamais partager le même compteur
// qu'un utilisateur normal qui aurait la même adresse email par coïncidence.
export async function POST(req: Request) {
  try {
    const { email, password } = (await req.json()) as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email et mot de passe requis' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const rateLimitKey = getRateLimitKey(`admin:${normalizedEmail}`, req);

    const { limited, retryAfterSeconds } = isRateLimited(rateLimitKey);
    if (limited) {
      return NextResponse.json(
        {
          success: false,
          error: `Trop de tentatives. Réessaie dans ${Math.ceil((retryAfterSeconds ?? 60) / 60)} min.`,
        },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds ?? 60) } },
      );
    }

    const admin = await prisma.admin.findUnique({ where: { email: normalizedEmail } });

    const invalidCredentials = () => {
      recordFailedAttempt(rateLimitKey);
      return NextResponse.json({ success: false, error: 'Email ou mot de passe incorrect' }, { status: 401 });
    };

    if (!admin) return invalidCredentials();

    const validPassword = await verifyPassword(password, admin.passwordHash);
    if (!validPassword) return invalidCredentials();

    if (!admin.isActive) {
      recordFailedAttempt(rateLimitKey);
      return NextResponse.json({ success: false, error: 'Ce compte admin a été désactivé.' }, { status: 403 });
    }

    clearAttempts(rateLimitKey);

    const token = await createAdminSessionToken({ adminId: admin.id, email: admin.email });

    const response = NextResponse.json({
      success: true,
      admin: { id: admin.id, email: admin.email, name: admin.name },
    });
    response.cookies.set(ADMIN_SESSION_COOKIE, token, ADMIN_SESSION_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    console.error('Admin Login Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
