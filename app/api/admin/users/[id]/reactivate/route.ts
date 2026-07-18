import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { logAdminAction } from '@/lib/adminAudit';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession();
    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'Utilisateur introuvable' }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isSuspended: false, suspendedAt: null, suspendedReason: null },
    });

    await logAdminAction({
      adminId: admin.adminId,
      adminEmail: admin.email,
      action: 'user.reactivate',
      targetType: 'User',
      targetId: id,
      details: { email: user.email },
    });

    return NextResponse.json({ success: true, data: { id: updated.id, isSuspended: updated.isSuspended } });
  } catch (error) {
    if (error instanceof Error && error.message === 'ADMIN_UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Admin Reactivate Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
