import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSiteUrl } from '@/lib/email';

// Lien cliqué depuis l'email de vérification (GET, pas de session requise —
// le token lui-même prouve l'identité). Redirige vers l'app avec un
// paramètre de statut plutôt que de renvoyer du JSON, puisque c'est ouvert
// directement dans le navigateur depuis un client mail.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  const siteUrl = getSiteUrl();

  if (!token) {
    return NextResponse.redirect(`${siteUrl}/login?verify=missing`);
  }

  try {
    const user = await prisma.user.findUnique({ where: { verificationToken: token } });

    if (!user || !user.verificationTokenExpiresAt || user.verificationTokenExpiresAt < new Date()) {
      return NextResponse.redirect(`${siteUrl}/login?verify=invalid`);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verificationToken: null, verificationTokenExpiresAt: null },
    });

    return NextResponse.redirect(`${siteUrl}/login?verify=success`);
  } catch (error) {
    console.error('Verify Email Error:', error);
    return NextResponse.redirect(`${siteUrl}/login?verify=error`);
  }
}
