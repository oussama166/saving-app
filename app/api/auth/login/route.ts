import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  verifyPassword,
  createSessionToken,
  createTwoFactorChallengeToken,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/auth';
import { getRateLimitKey, isRateLimited, recordFailedAttempt, clearAttempts } from '@/lib/rateLimit';
import { createSessionRecord } from '@/lib/sessionTracking';

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

    // Mot de passe correct mais 2FA activée : pas de cookie de session tout
    // de suite — juste un jeton temporaire (5 min) à présenter avec le code
    // TOTP/de récupération sur /api/auth/2fa/verify pour obtenir la vraie
    // session. Voir lib/auth.ts (createTwoFactorChallengeToken) pour le détail.
    if (user.twoFactorEnabled) {
      const challengeToken = await createTwoFactorChallengeToken(user.id);
      return NextResponse.json({ success: true, twoFactorRequired: true, challengeToken });
    }

    const { token, jti } = await createSessionToken({ userId: user.id, email: user.email });
    await createSessionRecord({ userId: user.id, jti, rawUserAgent: req.headers.get('user-agent') });

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
