import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { logAdminAction } from '@/lib/adminAudit';
import { ensureFeaturesSeeded, isKnownFeatureKey } from '@/lib/features';

// Active/désactive une fonctionnalité globalement et/ou met à jour son
// message custom. `enabled: false` ne coupe pas l'accès aux utilisateurs
// ayant une exception (FeatureAccessGrant) — voir
// lib/features.ts::isFeatureEnabledForUser. Les deux champs sont optionnels
// et indépendants : un appel peut ne changer que le message sans toucher à
// l'état activé/désactivé.
export async function PATCH(req: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    const admin = await requireAdminSession();
    const { key } = await params;
    if (!isKnownFeatureKey(key)) {
      return NextResponse.json({ success: false, error: 'Fonctionnalité inconnue' }, { status: 404 });
    }

    const body = (await req.json()) as { enabled?: boolean; customMessage?: string | null };
    if (body.enabled === undefined && body.customMessage === undefined) {
      return NextResponse.json({ success: false, error: 'Aucune modification fournie' }, { status: 400 });
    }
    if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Champ "enabled" doit être un booléen' }, { status: 400 });
    }

    await ensureFeaturesSeeded();

    const data: { enabled?: boolean; customMessage?: string | null } = {};
    if (body.enabled !== undefined) data.enabled = body.enabled;
    if (body.customMessage !== undefined) data.customMessage = body.customMessage?.trim() || null;

    const updated = await prisma.feature.update({ where: { key }, data });

    const actions: string[] = [];
    if (body.enabled !== undefined) actions.push(body.enabled ? 'feature.enable' : 'feature.disable');
    if (body.customMessage !== undefined) actions.push('feature.set_message');

    for (const action of actions) {
      await logAdminAction({ adminId: admin.adminId, adminEmail: admin.email, action, targetType: 'Feature', targetId: key });
    }

    return NextResponse.json({
      success: true,
      data: { key: updated.key, enabled: updated.enabled, customMessage: updated.customMessage },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'ADMIN_UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Admin Feature Toggle Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
