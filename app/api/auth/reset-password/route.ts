import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { token, password } = (await req.json()) as { token?: string; password?: string };

    if (!token) {
      return NextResponse.json({ success: false, error: 'Lien invalide' }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Le mot de passe doit contenir au moins 8 caractères' },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { passwordResetToken: token } });
    if (!user || !user.passwordResetTokenExpiresAt || user.passwordResetTokenExpiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Ce lien a expiré ou est invalide — demande un nouveau lien' },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(password);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetToken: null, passwordResetTokenExpiresAt: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset Password Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
