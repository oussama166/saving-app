import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { logAdminAction } from '@/lib/adminAudit';
import { isKnownFeatureKey } from '@/lib/features';

// Liste les exceptions d'accès accordées pour cette fonctionnalité (utile
// même si la fonctionnalité est actuellement activée — permet de préparer
// une liste d'exceptions à l'avance).
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    await requireAdminSession();
    const { key } = await params;
    if (!isKnownFeatureKey(key)) {
      return NextResponse.json({ success: false, error: 'Fonctionnalité inconnue' }, { status: 404 });
    }

    const grants = await prisma.featureAccessGrant.findMany({
      where: { featureKey: key },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { grantedAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: grants.map((g) => ({ userId: g.userId, email: g.user.email, name: g.user.name, grantedAt: g.grantedAt })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'ADMIN_UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Admin Feature Access List Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

// Accorde une exception d'accès à un utilisateur (recherché par email exact)
// pour cette fonctionnalité — a un effet même si la fonctionnalité est
// actuellement activée globalement (juste latent tant qu'elle n'est pas
// désactivée).
export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    const admin = await requireAdminSession();
    const { key } = await params;
    if (!isKnownFeatureKey(key)) {
      return NextResponse.json({ success: false, error: 'Fonctionnalité inconnue' }, { status: 404 });
    }

    const { email } = (await req.json()) as { email?: string };
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) {
      return NextResponse.json({ success: false, error: 'Email requis' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return NextResponse.json({ success: false, error: `Aucun utilisateur avec l'email "${normalizedEmail}"` }, { status: 404 });
    }

    // Feature doit déjà exister (créée via ensureFeaturesSeeded sur GET
    // /api/admin/features, forcément déjà appelé si l'admin est sur cette
    // page) — sinon la FK échouerait avec un 500 générique.
    const feature = await prisma.feature.findUnique({ where: { key } });
    if (!feature) {
      return NextResponse.json({ success: false, error: 'Fonctionnalité pas encore initialisée — recharge la page Admin > Fonctionnalités.' }, { status: 409 });
    }

    const grant = await prisma.featureAccessGrant.upsert({
      where: { featureKey_userId: { featureKey: key, userId: user.id } },
      update: {},
      create: { featureKey: key, userId: user.id },
    });

    await logAdminAction({
      adminId: admin.adminId,
      adminEmail: admin.email,
      action: 'feature.grant_access',
      targetType: 'User',
      targetId: user.id,
      details: { featureKey: key, email: user.email },
    });

    return NextResponse.json({ success: true, data: { userId: user.id, email: user.email, name: user.name, grantedAt: grant.grantedAt } });
  } catch (error) {
    if (error instanceof Error && error.message === 'ADMIN_UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Admin Feature Access Grant Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
