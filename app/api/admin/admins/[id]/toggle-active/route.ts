import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { logAdminAction } from '@/lib/adminAudit';

// Bascule isActive plutôt qu'une suppression en dur (voir commentaire sur le
// modèle Admin dans schema.prisma). Deux garde-fous pour ne jamais se
// retrouver sans accès au panel : impossible de se désactiver soi-même, et
// impossible de désactiver le dernier admin encore actif.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession();
    const { id } = await params;

    const target = await prisma.admin.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ success: false, error: 'Admin introuvable' }, { status: 404 });
    }

    const nextActive = !target.isActive;

    if (!nextActive) {
      if (target.id === session.adminId) {
        return NextResponse.json({ success: false, error: 'Impossible de désactiver ton propre compte' }, { status: 400 });
      }
      const activeCount = await prisma.admin.count({ where: { isActive: true } });
      if (activeCount <= 1) {
        return NextResponse.json({ success: false, error: 'Impossible de désactiver le dernier admin actif' }, { status: 400 });
      }
    }

    const updated = await prisma.admin.update({
      where: { id },
      data: { isActive: nextActive },
      select: { id: true, email: true, isActive: true },
    });

    await logAdminAction({
      adminId: session.adminId,
      adminEmail: session.email,
      action: nextActive ? 'admin.activate' : 'admin.deactivate',
      targetType: 'Admin',
      targetId: id,
      details: { email: target.email },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'ADMIN_UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Admin Toggle Active Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
