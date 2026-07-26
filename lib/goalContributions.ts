import { prisma } from '@/lib/prisma';
import { notifyRefresh } from '@/lib/sse';
import type { Prisma } from '@prisma/client';
import { getHouseholdMemberIds } from '@/lib/household';

// Même logique de rattrapage que lib/subscriptions.ts (pas de cron serveur —
// contrainte hébergement gratuit) : un objectif avec autoContribute=true
// prélève monthlyContribution le contributionDay de chaque mois, rattrapé au
// prochain chargement de la page Objectifs si l'utilisateur n'était pas
// connecté le jour J. Chaque versement (auto ou manuel) crée une
// GoalContribution (historique) et, si l'objectif a un compte + une
// catégorie configurés, une vraie Transaction (type savings) — cohérent
// avec le reste de l'app plutôt qu'un solde qui bouge en silence.

const MAX_CATCHUP_MONTHS = 36;

function formatYearMonth(year: number, month1to12: number): string {
  return `${year}-${String(month1to12).padStart(2, '0')}`;
}

function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

function nextYearMonth(year: number, month1to12: number): { year: number; month: number } {
  return month1to12 === 12 ? { year: year + 1, month: 1 } : { year, month: month1to12 + 1 };
}

function contributionDateFor(year: number, month1to12: number, day: number): Date {
  const clampedDay = Math.min(day, daysInMonth(year, month1to12));
  return new Date(year, month1to12 - 1, clampedDay, 12, 0, 0);
}

export interface GoalLike {
  id: string;
  accountId: string | null;
  contributionDay: number;
  lastContributedYearMonth: string | null;
}

/** Prochain versement à venir (ou du mois courant s'il n'a pas encore eu lieu) — affichage uniquement. */
export function getNextContributionDate(goal: GoalLike, from: Date = new Date()): Date {
  let year = from.getFullYear();
  let month = from.getMonth() + 1;

  const thisMonthDate = contributionDateFor(year, month, goal.contributionDay);
  const thisMonthKey = formatYearMonth(year, month);
  const alreadyDoneThisMonth = goal.lastContributedYearMonth === thisMonthKey;

  if (!alreadyDoneThisMonth && thisMonthDate >= new Date(from.getFullYear(), from.getMonth(), from.getDate())) {
    return thisMonthDate;
  }

  const next = nextYearMonth(year, month);
  year = next.year;
  month = next.month;
  return contributionDateFor(year, month, goal.contributionDay);
}

type TxClient = Prisma.TransactionClient;

async function insertContribution(
  tx: TxClient,
  params: {
    userId: string;
    goalId: string;
    goalName: string;
    accountId: string | null;
    categoryId: string | null;
    amount: number;
    date: Date;
    note: string | null;
    isAutomatic: boolean;
  },
) {
  const { userId, goalId, goalName, accountId, categoryId, amount, date, note, isAutomatic } = params;
  const absAmount = Math.abs(amount);
  let transactionId: string | null = null;

  if (accountId && categoryId) {
    const transaction = await tx.transaction.create({
      data: {
        userId,
        accountId,
        categoryId,
        merchant: `Épargne : ${goalName}`,
        amount: -absAmount,
        date,
      },
    });
    transactionId = transaction.id;
    await tx.account.update({ where: { id: accountId }, data: { balance: { decrement: absAmount } } });
  }

  await tx.goalContribution.create({
    data: { userId, goalId, amount: absAmount, date, note, isAutomatic, transactionId },
  });

  await tx.savingsGoal.update({ where: { id: goalId }, data: { currentAmount: { increment: absAmount } } });
}

/** Versement manuel (bouton "Ajouter un versement" dans l'UI, ou allocation salaire). */
export async function addManualContribution(params: {
  userId: string;
  goalId: string;
  amount: number;
  date?: Date;
  note?: string | null;
  isAutomatic?: boolean;
}): Promise<void> {
  const { userId, goalId, amount, date, note, isAutomatic } = params;
  const memberIds = await getHouseholdMemberIds(userId);
  const goal = await prisma.savingsGoal.findFirst({ where: { id: goalId, userId: { in: memberIds } } });
  if (!goal) throw new Error('GOAL_NOT_FOUND');

  await prisma.$transaction(async (tx) => {
    await insertContribution(tx, {
      // Attribué au propriétaire réel de l'objectif (peut différer de la
      // personne qui déclenche l'action, si son/sa partenaire l'a créé) —
      // voir lib/household.ts.
      userId: goal.userId,
      goalId,
      goalName: goal.name,
      accountId: goal.accountId,
      categoryId: goal.categoryId,
      amount,
      date: date ?? new Date(),
      note: note ?? null,
      isAutomatic: Boolean(isAutomatic),
    });
  });

  notifyRefresh();
}

/** Rattrape les versements automatiques mensuels manqués pour tous les objectifs actifs d'un utilisateur. */
export async function catchUpGoalContributions(userId: string): Promise<number> {
  const memberIds = await getHouseholdMemberIds(userId);
  const goals = await prisma.savingsGoal.findMany({
    where: { userId: { in: memberIds }, autoContribute: true, monthlyContribution: { gt: 0 } },
  });

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  let createdCount = 0;

  for (const goal of goals) {
    let { year, month } = goal.lastContributedYearMonth
      ? nextYearMonth(
          Number(goal.lastContributedYearMonth.slice(0, 4)),
          Number(goal.lastContributedYearMonth.slice(5, 7)),
        )
      : { year: goal.createdAt.getFullYear(), month: goal.createdAt.getMonth() + 1 };

    let iterations = 0;
    while (iterations < MAX_CATCHUP_MONTHS) {
      iterations += 1;
      const chargeDate = contributionDateFor(year, month, goal.contributionDay);
      if (chargeDate > today) break;

      const yearMonthKey = formatYearMonth(year, month);

      await prisma.$transaction(async (tx) => {
        await insertContribution(tx, {
          userId: goal.userId,
          goalId: goal.id,
          goalName: goal.name,
          accountId: goal.accountId,
          categoryId: goal.categoryId,
          amount: goal.monthlyContribution,
          date: chargeDate,
          note: 'Versement automatique mensuel',
          isAutomatic: true,
        });
        await tx.savingsGoal.update({ where: { id: goal.id }, data: { lastContributedYearMonth: yearMonthKey } });
      });

      createdCount += 1;
      const next = nextYearMonth(year, month);
      year = next.year;
      month = next.month;
    }
  }

  if (createdCount > 0) notifyRefresh();

  return createdCount;
}
