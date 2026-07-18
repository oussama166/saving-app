import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { generateSecureToken } from '@/lib/tokens';
import { sendVerificationEmail } from '@/lib/email';
import { logAdminAction } from '@/lib/adminAudit';

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession();
    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'Utilisateur introuvable' }, { status: 404 });
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

    await logAdminAction({
      adminId: admin.adminId,
      adminEmail: admin.email,
      action: 'user.resend_verification',
      targetType: 'User',
      targetId: id,
      details: { email: user.email, emailSent: sent },
    });

    return NextResponse.json({ success: true, emailSent: sent });
  } catch (error) {
    if (error instanceof Error && error.message === 'ADMIN_UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Admin Resend Verification Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
