import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, createSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '@/lib/auth';
import { seedDefaultsForUser } from '@/lib/seedDefaults';
import { generateSecureToken } from '@/lib/tokens';
import { sendVerificationEmail } from '@/lib/email';

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const { email, password, name } = (await req.json()) as {
      email?: string;
      password?: string;
      name?: string;
    };

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ success: false, error: 'Adresse email invalide' }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Le mot de passe doit contenir au moins 8 caractères' },
        { status: 400 },
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ success: false, error: 'Un compte existe déjà avec cet email' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const verificationToken = generateSecureToken();
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: name?.trim() || null,
        verificationToken,
        verificationTokenExpiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
      },
    });

    // Prépare un profil prêt à l'emploi : catégories/sous-catégories par
    // défaut, compte "Main Checking", UserSettings — le nouveau compte
    // démarre directement avec la structure budgétaire du site 1.
    await seedDefaultsForUser(prisma, user.id);

    // Best-effort : sendVerificationEmail ne lève jamais d'exception (voir
    // lib/email.ts), on peut donc l'attendre sans risquer de faire échouer
    // l'inscription si RESEND_API_KEY est absent ou si Resend est en panne.
    await sendVerificationEmail(user.email, verificationToken);

    const token = await createSessionToken({ userId: user.id, email: user.email });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerified },
    });
    response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    console.error('Signup Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
