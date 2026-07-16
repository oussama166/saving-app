import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hashPassword, verifyPassword } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const { currentPassword, newPassword } = (await req.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Mot de passe actuel et nouveau mot de passe requis' },
        { status: 400 },
      );
    }
    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Le nouveau mot de passe doit contenir au moins 8 caractères' },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }

    const validCurrent = await verifyPassword(currentPassword, user.passwordHash);
    if (!validCurrent) {
      return NextResponse.json({ success: false, error: 'Mot de passe actuel incorrect' }, { status: 401 });
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Change Password Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
