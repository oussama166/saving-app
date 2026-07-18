import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { generateSecureToken } from '@/lib/tokens';
import { sendPasswordResetEmail } from '@/lib/email';
import { logAdminAction } from '@/lib/adminAudit';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h — même durée que /api/auth/forgot-password

// Déclenche l'email de réinitialisation de mot de passe pour un utilisateur
// qui n'y arrive pas seul (ex: perte d'accès à son adresse habituelle mais
// qui peut prouver son identité autrement, contact support...). Même
// logique que /api/auth/forgot-password, mais initiée par un admin plutôt
// que par l'utilisateur lui-même — ne révèle jamais le nouveau mot de passe
// à l'admin, juste envoie le lien de réinitialisation à l'email du compte.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession();
    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'Utilisateur introuvable' }, { status: 404 });
    }

    const passwordResetToken = generateSecureToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken,
        passwordResetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const sent = await sendPasswordResetEmail(user.email, passwordResetToken);

    await logAdminAction({
      adminId: admin.adminId,
      adminEmail: admin.email,
      action: 'user.reset_password',
      targetType: 'User',
      targetId: id,
      details: { email: user.email, emailSent: sent },
    });

    return NextResponse.json({ success: true, emailSent: sent });
  } catch (error) {
    if (error instanceof Error && error.message === 'ADMIN_UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Admin Reset Password Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
