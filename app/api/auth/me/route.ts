import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getSession,
  requireSession,
  verifyPassword,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/auth';
import { generateSecureToken } from '@/lib/tokens';
import { sendVerificationEmail } from '@/lib/email';
import { deleteUserAccount } from '@/lib/deleteUserData';
import { createSessionRecord, deleteSessionRecord } from '@/lib/sessionTracking';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) {
      // Le compte n'existe plus (supprimé — par l'utilisateur lui-même ou
      // par un admin via app/api/admin/users/[id] DELETE) mais le cookie de
      // session, lui, reste valide côté navigateur (signature JWT toujours
      // correcte) jusqu'à son expiration naturelle (30 jours) — sans ça,
      // TopNav re-polling cette route en boucle resterait bloqué sur ce même
      // 401 indéfiniment, et toute route qui essaie d'ÉCRIRE une donnée
      // rattachée à ce userId (ex: ensureUserSeeded) échouerait avec une
      // erreur de contrainte FOREIGN KEY (le userId ne correspond plus à
      // aucun User). On coupe donc le cookie ici, comme pour la suspension
      // ci-dessous — le prochain chargement de page renvoie proprement vers
      // /login au lieu de laisser une session fantôme.
      const response = NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
      response.cookies.set(SESSION_COOKIE, '', { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
      return response;
    }

    // Compte suspendu par un admin (voir app/api/admin/users/[id]/suspend) :
    // la session JWT reste valide côté cookie mais on la coupe ici, ce qui a
    // pour effet de déconnecter l'utilisateur dès le prochain chargement de
    // page (TopNav appelle GET /api/auth/me sur chaque page).
    if (user.isSuspended) {
      const response = NextResponse.json(
        {
          success: false,
          error: user.suspendedReason
            ? `Ce compte est suspendu : ${user.suspendedReason}`
            : 'Ce compte est suspendu.',
        },
        { status: 403 },
      );
      response.cookies.set(SESSION_COOKIE, '', { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
      return response;
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    });
  } catch (error) {
    console.error('Me Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

// Met à jour le nom et/ou l'email du profil. Changer l'email exige le mot
// de passe actuel (action sensible : impacte l'identifiant de connexion) et
// remet emailVerified à false + renvoie un nouvel email de vérification.
export async function PATCH(req: Request) {
  try {
    const { userId, jti: currentJti } = await requireSession();
    const { name, email, currentPassword } = (await req.json()) as {
      name?: string;
      email?: string;
      currentPassword?: string;
    };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }

    const data: { name?: string | null; email?: string; emailVerified?: boolean; verificationToken?: string; verificationTokenExpiresAt?: Date } = {};
    let emailChanged = false;

    if (name !== undefined) {
      data.name = name.trim() || null;
    }

    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(normalizedEmail)) {
        return NextResponse.json({ success: false, error: 'Adresse email invalide' }, { status: 400 });
      }
      if (normalizedEmail !== user.email) {
        if (!currentPassword) {
          return NextResponse.json(
            { success: false, error: 'Mot de passe actuel requis pour changer d\'email' },
            { status: 400 },
          );
        }
        const validPassword = await verifyPassword(currentPassword, user.passwordHash);
        if (!validPassword) {
          return NextResponse.json({ success: false, error: 'Mot de passe incorrect' }, { status: 401 });
        }

        const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existing && existing.id !== userId) {
          return NextResponse.json({ success: false, error: 'Un compte existe déjà avec cet email' }, { status: 409 });
        }

        data.email = normalizedEmail;
        data.emailVerified = false;
        data.verificationToken = generateSecureToken();
        data.verificationTokenExpiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
        emailChanged = true;
      }
    }

    const updated = await prisma.user.update({ where: { id: userId }, data });

    if (emailChanged) {
      await sendVerificationEmail(updated.email, updated.verificationToken!);
    }

    // L'email fait partie du payload du cookie de session — on le
    // réémet pour rester cohérent si l'email a changé.
    const response = NextResponse.json({
      success: true,
      user: { id: updated.id, email: updated.email, name: updated.name, emailVerified: updated.emailVerified },
    });
    if (emailChanged) {
      // L'email fait partie du payload JWT, donc un nouveau jeton = un
      // nouveau jti — on ferme l'ancienne ligne Session (sinon elle traîne
      // indéfiniment, plus jamais rattachée à un cookie réel) et on ouvre
      // la nouvelle, best-effort dans les deux cas.
      await deleteSessionRecord(currentJti);
      const { token, jti } = await createSessionToken({ userId: updated.id, email: updated.email });
      await createSessionRecord({ userId: updated.id, jti, rawUserAgent: req.headers.get('user-agent') });
      response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
    }
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Me PATCH Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

// Supprime définitivement le compte et TOUTES les données financières
// associées. Action destructive et irréversible — exige le mot de passe
// actuel en confirmation. L'ordre de suppression respecte les contraintes
// FK (RESTRICT par défaut chez Prisma) : les tables qui référencent
// d'autres tables doivent être vidées avant celles qu'elles référencent.
export async function DELETE(req: Request) {
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

    await deleteUserAccount(userId);

    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, '', { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Me DELETE Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
