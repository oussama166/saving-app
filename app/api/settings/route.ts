import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { ensureUserSeeded } from '@/lib/seedDefaults';
import { getBudgetOwnerUserId } from '@/lib/household';
import { requireFeatureAccess } from '@/lib/features';

export const dynamic = 'force-dynamic';

// Marge de tolérance pour la validation "somme des allocations = 100%"
// (arrondis flottants côté client).
const SUM_TOLERANCE = 0.5;

export async function GET() {
  try {
    const { userId } = await requireSession();
    await requireFeatureAccess('profile', userId);

    // Filet de sécurité : comptes créés avant le passage à Turso (ou dont le
    // seed initial a échoué en route, ex: timeout réseau) — voir
    // lib/seedDefaults.ts. No-op si le compte est déjà correctement seedé.
    await ensureUserSeeded(prisma, userId);
    const budgetOwnerId = await getBudgetOwnerUserId(userId);

    const [settings, categories] = await Promise.all([
      prisma.userSettings.findUnique({ where: { userId: budgetOwnerId } }),
      prisma.category.findMany({
        where: { userId: budgetOwnerId, type: { in: ['expense', 'savings'] } },
        orderBy: { order: 'asc' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        referenceIncome: settings?.referenceIncome ?? 10000,
        currency: settings?.currency ?? 'MAD',
        budgetCycleStartDay: settings?.budgetCycleStartDay ?? 1,
        updatedAt: settings?.updatedAt ?? null,
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          order: c.order,
          budgetPct: c.budgetPct,
        })),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'FEATURE_DISABLED') {
      return NextResponse.json({ success: false, error: 'Cette fonctionnalité est temporairement désactivée.' }, { status: 403 });
    }
    console.error('Settings GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { userId } = await requireSession();
    await requireFeatureAccess('profile.budget_allocation', userId);
    const { referenceIncome, allocations, budgetCycleStartDay } = (await req.json()) as {
      referenceIncome: number;
      allocations: { id: string; budgetPct: number }[];
      budgetCycleStartDay?: number;
    };

    if (typeof referenceIncome !== 'number' || referenceIncome <= 0 || !Array.isArray(allocations)) {
      return NextResponse.json({ success: false, error: 'Données invalides' }, { status: 400 });
    }

    // Jour de paie optionnel (1-28, voir lib/budgetCycle.ts) — borné pour
    // éviter un jour > nombre de jours du mois le plus court (février) et
    // toute valeur farfelue envoyée par un client bugué. Absent/omis => on ne
    // touche pas au réglage existant (upsert plus bas retombe sur 1 par
    // défaut seulement à la création).
    if (
      budgetCycleStartDay !== undefined &&
      (typeof budgetCycleStartDay !== 'number' || budgetCycleStartDay < 1 || budgetCycleStartDay > 28)
    ) {
      return NextResponse.json({ success: false, error: 'Jour de paie invalide (1-28)' }, { status: 400 });
    }

    const total = allocations.reduce((acc, a) => acc + Number(a.budgetPct), 0);
    if (Math.abs(total - 100) > SUM_TOLERANCE) {
      return NextResponse.json(
        { success: false, error: `Le total des allocations doit être proche de 100% (actuellement ${total.toFixed(1)}%)` },
        { status: 400 },
      );
    }

    const budgetOwnerId = await getBudgetOwnerUserId(userId);

    // Vérifie que toutes les catégories fournies appartiennent bien au foyer
    // (propriétaire budget) avant de les mettre à jour.
    const owned = await prisma.category.findMany({
      where: { userId: budgetOwnerId, id: { in: allocations.map((a) => a.id) } },
      select: { id: true },
    });
    if (owned.length !== allocations.length) {
      return NextResponse.json({ success: false, error: 'Catégorie invalide' }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.userSettings.upsert({
        where: { userId: budgetOwnerId },
        update: {
          referenceIncome,
          ...(budgetCycleStartDay !== undefined ? { budgetCycleStartDay } : {}),
        },
        create: {
          userId: budgetOwnerId,
          referenceIncome,
          ...(budgetCycleStartDay !== undefined ? { budgetCycleStartDay } : {}),
        },
      }),
      ...allocations.map((a) =>
        prisma.category.update({
          where: { id: a.id },
          data: { budgetPct: Number(a.budgetPct) },
        }),
      ),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'FEATURE_DISABLED') {
      return NextResponse.json({ success: false, error: 'Cette fonctionnalité est temporairement désactivée.' }, { status: 403 });
    }
    console.error('Settings PUT Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
