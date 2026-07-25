import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, verifyPassword } from '@/lib/auth';

// Désactivation : exige le mot de passe actuel (action sensible — retire une
// protection du compte) plutôt qu'un simple bouton, même si la session est
// déjà authentifiée (protège contre un appareil laissé déverrouillé/session
// volée qui n'aurait pas le mot de passe).
export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const { password } = (await req.json()) as { password?: string };

    if (!password) {
      return NextResponse.json({ success: false, error: 'Mot de passe requis' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }

    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json({ success: false, error: 'Mot de passe incorrect' }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecoveryCodes: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('2FA Disable Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
