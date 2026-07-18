import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { logAdminAction } from '@/lib/adminAudit';

// Suspend un compte : bloqué à la connexion (voir /api/auth/login) et sa
// session active est coupée au prochain appel de /api/auth/me (utilisé par
// TopNav sur chaque page, donc effet quasi immédiat même si le cookie de
// session est encore valide côté navigateur).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession();
    const { id } = await params;
    const { reason } = (await req.json().catch(() => ({}))) as { reason?: string };

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'Utilisateur introuvable' }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isSuspended: true, suspendedAt: new Date(), suspendedReason: reason?.trim() || null },
    });

    await logAdminAction({
      adminId: admin.adminId,
      adminEmail: admin.email,
      action: 'user.suspend',
      targetType: 'User',
      targetId: id,
      details: { email: user.email, reason: reason?.trim() || null },
    });

    return NextResponse.json({
      success: true,
      data: { id: updated.id, isSuspended: updated.isSuspended, suspendedAt: updated.suspendedAt, suspendedReason: updated.suspendedReason },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'ADMIN_UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Admin Suspend Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
