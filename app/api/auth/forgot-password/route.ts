import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSecureToken } from '@/lib/tokens';
import { sendPasswordResetEmail } from '@/lib/email';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h — plus court que la vérification d'email, c'est sensible

export async function POST(req: Request) {
  try {
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
