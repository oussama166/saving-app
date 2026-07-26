import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { ensureFeaturesSeeded, FEATURE_REGISTRY } from '@/lib/features';

// Liste toutes les fonctionnalités gérables (voir lib/features.ts) avec leur
// état actuel + le nombre d'exceptions d'accès accordées. Seede
// paresseusement les Feature manquantes (nouvelle clé ajoutée au registre
// depuis le dernier déploiement) avant de lire, pour que la page Admin >
// Fonctionnalités reflète toujours le registre complet sans migration
// séparée à chaque ajout de section.
export async function GET() {
  try {
    await requireAdminSession();
    await ensureFeaturesSeeded();

    const features = await prisma.feature.findMany({
      where: { key: { in: FEATURE_REGISTRY.map((f) => f.key) } },
      include: { _count: { select: { accessGrants: true } } },
    });
    const byKey = new Map(features.map((f) => [f.key, f]));

    // Ordonné selon le registre (ordre de déclaration = ordre d'affichage),
    // pas l'ordre arbitraire de la base.
    const data = FEATURE_REGISTRY.map((def) => {
      const row = byKey.get(def.key);
      return {
        key: def.key,
        name: def.name,
        description: def.description,
        parentKey: def.parentKey ?? null,
        enabled: row?.enabled ?? true,
        customMessage: row?.customMessage ?? null,
        accessGrantCount: row?._count.accessGrants ?? 0,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === 'ADMIN_UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Admin Features List Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
