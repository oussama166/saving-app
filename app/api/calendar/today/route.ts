import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getHouseholdContext } from '@/lib/household';
import { requireFeatureAccess } from '@/lib/features';
import { computeBalanceProjection, getTodayDiscretionarySpendMad, getDiscretionaryCategoryBreakdown } from '@/lib/billCalendar';

// Version allégée de /api/calendar : uniquement les chiffres du jour (pas la
// grille du mois ni la série complète jusqu'à la paie) — pensée pour être
// appelée fréquemment/légèrement depuis des endroits hors de la page
// Calendrier elle-même (widget Dashboard, alerte de saisie dans Saisie &
// Historique).
export async function GET() {
  try {
    const { userId } = await requireSession();
    await requireFeatureAccess('calendar', userId);
    const ctx = await getHouseholdContext(userId);

    const settings = await prisma.userSettings.findUnique({ where: { userId: ctx.budgetOwnerId } });
    const payDay = settings?.budgetCycleStartDay ?? 1;

    const projection = await computeBalanceProjection(ctx, payDay);
    const [todaySpentMad, categoryBreakdown] = await Promise.all([
      getTodayDiscretionarySpendMad(ctx),
      getDiscretionaryCategoryBreakdown(ctx, projection.safeDailySpendMad),
    ]);

    const minProjectedBalanceMad = projection.points.reduce(
      (min, p) => Math.min(min, p.balanceMad),
      projection.startBalanceMad,
    );

    return NextResponse.json({
      success: true,
      data: {
        startBalanceMad: projection.startBalanceMad,
        nextPayday: projection.nextPayday.toISOString(),
        daysRemaining: projection.daysRemaining,
        safeDailySpendMad: projection.safeDailySpendMad,
        remainingTodayMad: Math.max(0, projection.safeDailySpendMad - todaySpentMad),
        todaySpentMad,
        minProjectedBalanceMad,
        categoryBreakdown,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'FEATURE_DISABLED') {
      return NextResponse.json({ success: false, error: 'Cette fonctionnalité est temporairement désactivée.' }, { status: 403 });
    }
    console.error('Calendar Today GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
