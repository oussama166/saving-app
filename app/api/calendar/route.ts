import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getHouseholdContext } from '@/lib/household';
import { requireFeatureAccess } from '@/lib/features';
import { getMonthEvents, computeBalanceProjection, getTodayDiscretionarySpendMad, getDiscretionaryCategoryBreakdown } from '@/lib/billCalendar';

// Vue calendrier des paiements — agrège abonnements/dettes/virements
// récurrents/factures manuelles pour un mois donné (?year&month, défaut :
// mois courant), et calcule la projection de solde jour par jour jusqu'à la
// prochaine paie (voir lib/billCalendar.ts).
export async function GET(req: Request) {
  try {
    const { userId } = await requireSession();
    await requireFeatureAccess('calendar', userId);
    const ctx = await getHouseholdContext(userId);

    const url = new URL(req.url);
    const now = new Date();
    const year = Number(url.searchParams.get('year')) || now.getFullYear();
    const month = Number(url.searchParams.get('month')) || now.getMonth() + 1;

    const settings = await prisma.userSettings.findUnique({ where: { userId: ctx.budgetOwnerId } });
    const payDay = settings?.budgetCycleStartDay ?? 1;

    const [events, projection] = await Promise.all([
      getMonthEvents(ctx, year, month),
      computeBalanceProjection(ctx, payDay),
    ]);

    // Dépendent du résultat de la projection (safeDailySpendMad du jour) —
    // récupérés après, pas dans le même Promise.all.
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
        events,
        projection: {
          startBalanceMad: projection.startBalanceMad,
          nextPayday: projection.nextPayday.toISOString(),
          daysRemaining: projection.daysRemaining,
          committedOutflowMad: projection.committedOutflowMad,
          safeDailySpendMad: projection.safeDailySpendMad,
          minProjectedBalanceMad,
          todaySpentMad,
          categoryBreakdown,
          points: projection.points.map((p) => ({
            date: p.date.toISOString(),
            balanceMad: p.balanceMad,
            events: p.events,
            safeDailySpendMad: p.safeDailySpendMad,
          })),
        },
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'FEATURE_DISABLED') {
      return NextResponse.json({ success: false, error: 'Cette fonctionnalité est temporairement désactivée.' }, { status: 403 });
    }
    console.error('Calendar GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
