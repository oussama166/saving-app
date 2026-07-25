import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { verifyTotpCode, generateRecoveryCodes, hashRecoveryCodes } from '@/lib/twoFactor';

// Étape 2/2 de l'activation : vérifie que l'utilisateur a bien scanné le QR
// et peut générer un code valide, active la 2FA, et génère les codes de
// récupération (retournés en clair UNE SEULE FOIS ici — jamais re-affichés
// ni récupérables ensuite, seul un hash bcrypt est conservé en base).
export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const { code } = (await req.json()) as { code?: string };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    if (!user.twoFactorSecret) {
      return NextResponse.json(
        { success: false, error: 'Aucune configuration 2FA en cours — relance depuis le début.' },
        { status: 400 },
      );
    }
    if (!code) {
      return NextResponse.json({ success: false, error: 'Code requis' }, { status: 400 });
    }

    const valid = await verifyTotpCode(user.twoFactorSecret, code);
    if (!valid) {
      return NextResponse.json({ success: false, error: 'Code incorrect ou expiré' }, { status: 400 });
    }

    const recoveryCodes = generateRecoveryCodes();
    const hashed = await hashRecoveryCodes(recoveryCodes);

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorRecoveryCodes: hashed },
    });

    return NextResponse.json({ success: true, recoveryCodes });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('2FA Confirm Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
