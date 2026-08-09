import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  verifyTwoFactorChallengeToken,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/auth';
import { verifyTotpCode, consumeRecoveryCode } from '@/lib/twoFactor';
import { getRateLimitKey, isRateLimited, recordFailedAttempt, clearAttempts } from '@/lib/rateLimit';
import { createSessionRecord } from '@/lib/sessionTracking';

// Étape 2 du login pour un compte avec 2FA activée (voir app/api/auth/login
// pour l'étape 1 — mot de passe + émission du challengeToken). Accepte soit
// un code TOTP à 6 chiffres, soit un code de récupération à usage unique
// (format XXXX-XXXX) si l'utilisateur a perdu l'accès à son app
// d'authentification. Rate-limité comme le login (même bucket namespace),
// pour empêcher un bruteforce des 6 chiffres même avec un challengeToken
// valide en main.
export async function POST(req: Request) {
  try {
    const { challengeToken, code, recoveryCode } = (await req.json()) as {
      challengeToken?: string;
      code?: string;
      recoveryCode?: string;
    };

    if (!challengeToken || (!code && !recoveryCode)) {
      return NextResponse.json(
        { success: false, error: 'Jeton et code (ou code de récupération) requis' },
        { status: 400 },
      );
    }

    const userId = await verifyTwoFactorChallengeToken(challengeToken);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Session de connexion expirée — reconnecte-toi.' },
        { status: 401 },
      );
    }

    const rateLimitKey = getRateLimitKey(`2fa:${userId}`, req);
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

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      recordFailedAttempt(rateLimitKey);
      return NextResponse.json({ success: false, error: 'Configuration 2FA invalide' }, { status: 400 });
    }

    let ok = false;
    if (code) {
      ok = await verifyTotpCode(user.twoFactorSecret, code);
    } else if (recoveryCode) {
      const result = await consumeRecoveryCode(recoveryCode, user.twoFactorRecoveryCodes);
      if (result) {
        ok = true;
        await prisma.user.update({ where: { id: userId }, data: { twoFactorRecoveryCodes: result.remaining } });
      }
    }

    if (!ok) {
      recordFailedAttempt(rateLimitKey);
      return NextResponse.json({ success: false, error: 'Code incorrect' }, { status: 401 });
    }

    clearAttempts(rateLimitKey);

    const { token, jti } = await createSessionToken({ userId: user.id, email: user.email });
    await createSessionRecord({ userId: user.id, jti, rawUserAgent: req.headers.get('user-agent') });
    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    });
    response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    console.error('2FA Verify Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
