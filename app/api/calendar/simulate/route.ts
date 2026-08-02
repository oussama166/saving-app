import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getHouseholdContext } from '@/lib/household';
import { requireFeatureAccess } from '@/lib/features';
import { computeBalanceProjection } from '@/lib/billCalendar';

// Simulateur "et si" — rejoue la projection de solde avec UNE dépense
// hypothétique en plus, sans jamais rien écrire en base (ni Transaction, ni
// Bill). Purement un aller-retour de calcul déterministe pour aider à
// décider avant de dépenser réellement.
export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    await requireFeatureAccess('calendar', userId);
    const ctx = await getHouseholdContext(userId);

    const body = await req.json();
    const { amountMad, date, name } = body as { amountMad?: number; date?: string; name?: string };

    const numericAmount = Number(amountMad);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Montant invalide' }, { status: 400 });
    }
    const parsedDate = date ? new Date(date) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json({ success: false, error: 'Date invalide' }, { status: 400 });
    }

    const settings = await prisma.userSettings.findUnique({ where: { userId: ctx.budgetOwnerId } });
    const payDay = settings?.budgetCycleStartDay ?? 1;

    const [baseline, simulated] = await Promise.all([
      computeBalanceProjection(ctx, payDay),
      computeBalanceProjection(ctx, payDay, [{ amountMad: numericAmount, dueDate: parsedDate, name }]),
    ]);

    const minOf = (proj: typeof baseline) =>
      proj.points.reduce((min, p) => Math.min(min, p.balanceMad), proj.startBalanceMad);

    const withinWindow = parsedDate >= new Date(new Date().setHours(0, 0, 0, 0)) && parsedDate <= baseline.nextPayday;

    return NextResponse.json({
      success: true,
      data: {
        withinWindow,
        nextPayday: baseline.nextPayday.toISOString(),
        baseline: {
          safeDailySpendMad: baseline.safeDailySpendMad,
          minProjectedBalanceMad: minOf(baseline),
        },
        simulated: {
          safeDailySpendMad: simulated.safeDailySpendMad,
          minProjectedBalanceMad: minOf(simulated),
          points: simulated.points.map((p) => ({
            date: p.date.toISOString(),
            balanceMad: p.balanceMad,
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
    console.error('Calendar Simulate Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
