import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, createSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '@/lib/auth';
import { getRateLimitKey, isRateLimited, recordFailedAttempt, clearAttempts } from '@/lib/rateLimit';

export async function POST(req: Request) {
  try {
    const { email, password } = (await req.json()) as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email et mot de passe requis' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const rateLimitKey = getRateLimitKey(normalizedEmail, req);

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

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Message volontairement identique dans les deux cas (email inconnu /
    // mot de passe incorrect) pour ne pas révéler si un email est enregistré.
    const invalidCredentials = () => {
      recordFailedAttempt(rateLimitKey);
      return NextResponse.json({ success: false, error: 'Email ou mot de passe incorrect' }, { status: 401 });
    };

    if (!user) return invalidCredentials();

    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) return invalidCredentials();

    if (user.isSuspended) {
      recordFailedAttempt(rateLimitKey);
      return NextResponse.json(
        {
          success: false,
          error: user.suspendedReason
            ? `Ce compte est suspendu : ${user.suspendedReason}`
            : 'Ce compte est suspendu. Contacte le support pour plus d\'informations.',
        },
        { status: 403 },
      );
    }

    clearAttempts(rateLimitKey);

    const token = await createSessionToken({ userId: user.id, email: user.email });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    });
    response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    console.error('Login Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
