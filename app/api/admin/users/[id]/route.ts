import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { deleteUserAccount } from '@/lib/deleteUserData';
import { logAdminAction } from '@/lib/adminAudit';

// Accès admin en lecture aux données financières d'un utilisateur (comptes,
// transactions récentes, objectifs, abonnements) — décision explicite de
// l'utilisateur lors de la conception du panel admin. Aucune écriture n'est
// possible sur ces données via cette route (uniquement via suspend/
// reactivate/delete, des actions de modération, pas de modification directe
// des finances d'un utilisateur).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession();
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        settings: true,
        accounts: { orderBy: { createdAt: 'asc' } },
        savingsGoals: { orderBy: { createdAt: 'desc' } },
        subscriptions: { orderBy: { createdAt: 'desc' } },
        transactions: { orderBy: { date: 'desc' }, take: 50, include: { category: true, account: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'Utilisateur introuvable' }, { status: 404 });
    }

    // On ne renvoie jamais le hash du mot de passe, même à un admin.
    const safeUser: Record<string, unknown> = { ...user };
    delete safeUser.passwordHash;

    return NextResponse.json({ success: true, data: safeUser });
  } catch (error) {
    if (error instanceof Error && error.message === 'ADMIN_UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Admin User Detail Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

// Suppression admin d'un compte utilisateur — même cascade que la
// suppression volontaire par l'utilisateur (lib/deleteUserData.ts), mais
// déclenchée sans mot de passe (l'admin est déjà authentifié séparément).
// Irréversible.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession();
    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'Utilisateur introuvable' }, { status: 404 });
    }

    await deleteUserAccount(id);

    await logAdminAction({
      adminId: admin.adminId,
      adminEmail: admin.email,
      action: 'user.delete',
      targetType: 'User',
      targetId: id,
      details: { email: user.email },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'ADMIN_UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Admin User Delete Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
