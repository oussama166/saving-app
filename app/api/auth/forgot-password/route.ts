import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSecureToken } from '@/lib/tokens';
import { sendPasswordResetEmail } from '@/lib/email';
import { getRateLimitKey, isRateLimited, recordFailedAttempt } from '@/lib/rateLimit';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h — plus court que la vérification d'email, c'est sensible

export async function POST(req: Request) {
  try {
    // Anti-abus par IP — sans ça, n'importe qui peut spammer la boîte mail
    // d'un tiers en déclenchant des emails de réinitialisation en boucle
    // (voir lib/rateLimit.ts, même mécanisme que signup).
    const rateLimitKey = getRateLimitKey('forgot-password', req);
    const { limited, retryAfterSeconds } = isRateLimited(rateLimitKey);
    if (limited) {
      return NextResponse.json(
        {
          success: false,
          error: `Trop de demandes. Réessaie dans ${Math.ceil((retryAfterSeconds ?? 60) / 60)} min.`,
        },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds ?? 60) } },
      );
    }
    recordFailedAttempt(rateLimitKey);

    const { email } = (await req.json()) as { email?: string };
    if (!email) {
      return NextResponse.json({ success: false, error: 'Email requis' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Toujours répondre succès, que l'email existe ou non — ne pas révéler
    // si une adresse est enregistrée (même logique que /api/auth/login).
    if (user) {
      const passwordResetToken = generateSecureToken();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken,
          passwordResetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });
      await sendPasswordResetEmail(user.email, passwordResetToken);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
