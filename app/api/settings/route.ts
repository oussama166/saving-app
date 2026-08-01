import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { ensureUserSeeded } from '@/lib/seedDefaults';
import { getBudgetOwnerUserId } from '@/lib/household';
import { requireFeatureAccess } from '@/lib/features';
import { BUDGET_METHODS } from '@/lib/budgetMethods';

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
        budgetMethod: settings?.budgetMethod ?? '503020',
        updatedAt: settings?.updatedAt ?? null,
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          order: c.order,
          budgetPct: c.budgetPct,
          budgetGroup: c.budgetGroup ?? null,
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
    const { referenceIncome, allocations, budgetCycleStartDay, budgetMethod } = (await req.json()) as {
      referenceIncome: number;
      allocations: { id: string; budgetPct: number; budgetGroup?: string | null }[];
      budgetCycleStartDay?: number;
      budgetMethod?: string;
    };

    if (typeof referenceIncome !== 'number' || referenceIncome <= 0 || !Array.isArray(allocations)) {
      return NextResponse.json({ success: false, error: 'Données invalides' }, { status: 400 });
    }

    // Méthodologie de budget (page Profil, voir lib/budgetMethods.ts) —
    // optionnelle, on ne touche pas au réglage existant si omise. Clé
    // vérifiée contre le registre pour éviter une valeur farfelue qui ferait
    // retomber silencieusement sur "503020" partout ailleurs (voir
    // getBudgetMethodDef).
    if (budgetMethod !== undefined && !(budgetMethod in BUDGET_METHODS)) {
      return NextResponse.json({ success: false, error: 'Méthode de budget invalide' }, { status: 400 });
    }

    for (const a of allocations) {
      if (a.budgetGroup !== undefined && a.budgetGroup !== null && a.budgetGroup !== 'essential' && a.budgetGroup !== 'discretionary') {
        return NextResponse.json({ success: false, error: 'Groupe de catégorie invalide' }, { status: 400 });
      }
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
          ...(budgetMethod !== undefined ? { budgetMethod } : {}),
        },
        create: {
          userId: budgetOwnerId,
          referenceIncome,
          ...(budgetCycleStartDay !== undefined ? { budgetCycleStartDay } : {}),
          ...(budgetMethod !== undefined ? { budgetMethod } : {}),
        },
      }),
      ...allocations.map((a) =>
        prisma.category.update({
          where: { id: a.id },
          data: {
            budgetPct: Number(a.budgetPct),
            ...(a.budgetGroup !== undefined ? { budgetGroup: a.budgetGroup } : {}),
          },
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
