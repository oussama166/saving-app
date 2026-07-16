import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { generateSecureToken } from '@/lib/tokens';
import { sendVerificationEmail } from '@/lib/email';

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export async function POST() {
  try {
    const { userId } = await requireSession();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    if (user.emailVerified) {
      return NextResponse.json({ success: false, error: 'Email déjà vérifié' }, { status: 400 });
    }

    const verificationToken = generateSecureToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationTokenExpiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
      },
    });

    const sent = await sendVerificationEmail(user.email, verificationToken);
    return NextResponse.json({ success: true, emailSent: sent });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Resend Verification Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
