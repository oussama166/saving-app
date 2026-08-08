import { prisma } from '@/lib/prisma';
import type { HouseholdContext } from '@/lib/household';

// Historique du patrimoine net — une ligne par (userId=budgetOwnerId, jour),
// capturée à chaque chargement du dashboard à partir de totaux DÉJÀ calculés
// par /api/dashboard (aucune requête supplémentaire ici). Même principe
// d'idempotence que captureDailyBudgetSnapshot (lib/budgetDiscipline.ts).

function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export interface NetWorthComponents {
  checkingBalanceMad: number;
  savingsLockedMad: number;
  portfolioValueMad: number;
  debtsMad: number;
}

export async function captureNetWorthSnapshot(ctx: HouseholdContext, components: NetWorthComponents): Promise<void> {
  const today = atMidnight(new Date());
  const netWorthMad =
    components.checkingBalanceMad + components.savingsLockedMad + components.portfolioValueMad - components.debtsMad;

  await prisma.netWorthSnapshot.upsert({
    where: { userId_date: { userId: ctx.budgetOwnerId, date: today } },
    update: { ...components, netWorthMad },
    create: { userId: ctx.budgetOwnerId, date: today, ...components, netWorthMad },
  });
}

export interface NetWorthHistoryPoint {
  date: string;
  netWorthMad: number;
  checkingBalanceMad: number;
  savingsLockedMad: number;
  portfolioValueMad: number;
  debtsMad: number;
}

export async function getNetWorthHistory(ctx: HouseholdContext, days = 180): Promise<NetWorthHistoryPoint[]> {
  const today = atMidnight(new Date());
  const from = new Date(today);
  from.setDate(from.getDate() - days);

  const snapshots = await prisma.netWorthSnapshot.findMany({
    where: { userId: ctx.budgetOwnerId, date: { gte: from } },
    orderBy: { date: 'asc' },
  });

  return snapshots.map(
    (s: {
      date: Date;
      netWorthMad: number;
      checkingBalanceMad: number;
      savingsLockedMad: number;
      portfolioValueMad: number;
      debtsMad: number;
    }) => ({
      date: s.date.toISOString(),
      netWorthMad: s.netWorthMad,
      checkingBalanceMad: s.checkingBalanceMad,
      savingsLockedMad: s.savingsLockedMad,
      portfolioValueMad: s.portfolioValueMad,
      debtsMad: s.debtsMad,
    }),
  );
}
