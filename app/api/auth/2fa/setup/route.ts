import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { generateTwoFactorSecret, buildOtpAuthUri } from '@/lib/twoFactor';

// Étape 1/2 de l'activation : génère un nouveau secret TOTP et le stocke
// immédiatement (twoFactorEnabled reste false) — évite d'avoir à faire
// transiter le secret dans le body de la requête de confirmation, puisque
// le QR affiché au setup encode déjà ce même secret. Si l'utilisateur
// abandonne le setup, le secret reste stocké mais inutilisé (inoffensif :
// tant que twoFactorEnabled=false, il n'est jamais consulté au login).
// Rappeler ce endpoint régénère un nouveau secret (invalide l'ancien QR).
export async function POST() {
  try {
    const { userId } = await requireSession();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { success: false, error: 'La 2FA est déjà activée — désactive-la avant de la reconfigurer.' },
        { status: 400 },
      );
    }

    const secret = generateTwoFactorSecret();
    await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });

    const otpauthUrl = buildOtpAuthUri(user.email, secret);

    return NextResponse.json({ success: true, secret, otpauthUrl });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('2FA Setup Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
