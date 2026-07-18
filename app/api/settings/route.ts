import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { ensureUserSeeded } from '@/lib/seedDefaults';

export const dynamic = 'force-dynamic';

// Marge de tolérance pour la validation "somme des allocations = 100%"
// (arrondis flottants côté client).
const SUM_TOLERANCE = 0.5;

export async function GET() {
  try {
    const { userId } = await requireSession();

    // Filet de sécurité : comptes créés avant le passage à Turso (ou dont le
    // seed initial a échoué en route, ex: timeout réseau) — voir
    // lib/seedDefaults.ts. No-op si le compte est déjà correctement seedé.
    await ensureUserSeeded(prisma, userId);

    const [settings, categories] = await Promise.all([
      prisma.userSettings.findUnique({ where: { userId } }),
      prisma.category.findMany({
        where: { userId, type: { in: ['expense', 'savings'] } },
        orderBy: { order: 'asc' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        referenceIncome: settings?.referenceIncome ?? 10000,
        currency: settings?.currency ?? 'MAD',
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
    console.error('Settings GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { userId } = await requireSession();
    const { referenceIncome, allocations } = (await req.json()) as {
      referenceIncome: number;
      allocations: { id: string; budgetPct: number }[];
    };

    if (typeof referenceIncome !== 'number' || referenceIncome <= 0 || !Array.isArray(allocations)) {
      return NextResponse.json({ success: false, error: 'Données invalides' }, { status: 400 });
    }

    const total = allocations.reduce((acc, a) => acc + Number(a.budgetPct), 0);
    if (Math.abs(total - 100) > SUM_TOLERANCE) {
      return NextResponse.json(
        { success: false, error: `Le total des allocations doit être proche de 100% (actuellement ${total.toFixed(1)}%)` },
        { status: 400 },
      );
    }

    // Vérifie que toutes les catégories fournies appartiennent bien à
    // l'utilisateur connecté avant de les mettre à jour.
    const owned = await prisma.category.findMany({
      where: { userId, id: { in: allocations.map((a) => a.id) } },
      select: { id: true },
    });
    if (owned.length !== allocations.length) {
      return NextResponse.json({ success: false, error: 'Catégorie invalide' }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.userSettings.upsert({
        where: { userId },
        update: { referenceIncome },
        create: { userId, referenceIncome },
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
    console.error('Settings PUT Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
