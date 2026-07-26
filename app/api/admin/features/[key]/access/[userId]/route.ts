import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { logAdminAction } from '@/lib/adminAudit';
import { isKnownFeatureKey } from '@/lib/features';

// Révoque l'exception d'accès d'un utilisateur pour cette fonctionnalité.
export async function DELETE(_req: Request, { params }: { params: Promise<{ key: string; userId: string }> }) {
  try {
    const admin = await requireAdminSession();
    const { key, userId } = await params;
    if (!isKnownFeatureKey(key)) {
      return NextResponse.json({ success: false, error: 'Fonctionnalité inconnue' }, { status: 404 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });

    await prisma.featureAccessGrant.deleteMany({ where: { featureKey: key, userId } });

    await logAdminAction({
      adminId: admin.adminId,
      adminEmail: admin.email,
      action: 'feature.revoke_access',
      targetType: 'User',
      targetId: userId,
      details: { featureKey: key, email: user?.email },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'ADMIN_UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Admin Feature Access Revoke Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
