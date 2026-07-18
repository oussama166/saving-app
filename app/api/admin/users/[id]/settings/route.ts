import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { logAdminAction } from '@/lib/adminAudit';

// Édition admin des paramètres financiers d'un utilisateur (revenu de
// référence, devise, objectif du fonds d'urgence en mois) — pas d'écriture
// possible sur les comptes/transactions eux-mêmes, seulement ces réglages,
// utile par exemple pour corriger une valeur saisie par erreur sans devoir
// demander à l'utilisateur de le faire lui-même.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession();
    const { id } = await params;
    const { referenceIncome, currency, emergencyFundTargetMonths } = (await req.json()) as {
      referenceIncome?: number;
      currency?: string;
      emergencyFundTargetMonths?: number;
    };

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'Utilisateur introuvable' }, { status: 404 });
    }

    if (referenceIncome !== undefined && (!Number.isFinite(referenceIncome) || referenceIncome < 0)) {
      return NextResponse.json({ success: false, error: 'Revenu de référence invalide' }, { status: 400 });
    }
    if (emergencyFundTargetMonths !== undefined && (!Number.isFinite(emergencyFundTargetMonths) || emergencyFundTargetMonths < 0)) {
      return NextResponse.json({ success: false, error: "Objectif fonds d'urgence invalide" }, { status: 400 });
    }
    if (currency !== undefined && !currency.trim()) {
      return NextResponse.json({ success: false, error: 'Devise invalide' }, { status: 400 });
    }

    const data = {
      ...(referenceIncome !== undefined && { referenceIncome }),
      ...(currency !== undefined && { currency: currency.trim() }),
      ...(emergencyFundTargetMonths !== undefined && { emergencyFundTargetMonths }),
    };

    const updated = await prisma.userSettings.upsert({
      where: { userId: id },
      update: data,
      create: {
        userId: id,
        referenceIncome: referenceIncome ?? 10000,
        currency: currency?.trim() || 'MAD',
        emergencyFundTargetMonths: emergencyFundTargetMonths ?? 3,
      },
    });

    await logAdminAction({
      adminId: admin.adminId,
      adminEmail: admin.email,
      action: 'user.update_settings',
      targetType: 'User',
      targetId: id,
      details: { email: user.email, ...data },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'ADMIN_UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Admin User Settings Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
