import { prisma } from '@/lib/prisma';
import { getHouseholdContext } from '@/lib/household';
import { executeTransfer } from '@/lib/transferEngine';

function cycleKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export interface RecurringTransferRunResult {
  ruleId: string;
  ok: boolean;
  error?: string;
}

/**
 * Exécute les virements automatiques récurrents dus aujourd'hui (voir
 * prisma/schema.prisma : RecurringTransfer, dayOfMonth 1-28) — appelée par
 * app/api/cron/recurring-transfers/route.ts, un job planifié externe une
 * fois par jour (même pattern que sendWeeklyDigestForUser).
 *
 * "Dû" = dayOfMonth de la règle correspond au jour du mois de referenceDate
 * ET pas déjà exécutée ce mois-ci (lastRunCycle !== cycle courant) — la
 * comparaison sur un cycle "YYYY-MM" plutôt que sur lastRunAt seul évite une
 * double exécution si le cron externe tourne plusieurs fois le même jour.
 * Une règle qui échoue (solde insuffisant, compte supprimé...) n'est PAS
 * marquée comme exécutée : comme dayOfMonth ne matchera plus avant le mois
 * suivant, elle sera simplement retentée au prochain cycle, pas le jour
 * même — comportement volontairement simple plutôt qu'un système de retry.
 */
export async function runDueRecurringTransfers(referenceDate: Date = new Date()): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  results: RecurringTransferRunResult[];
}> {
  const today = referenceDate.getDate();
  const currentCycle = cycleKey(referenceDate);

  const dueRules = await prisma.recurringTransfer.findMany({
    where: { active: true, dayOfMonth: today },
  });

  const results: RecurringTransferRunResult[] = [];

  for (const rule of dueRules) {
    if (rule.lastRunCycle === currentCycle) continue;

    try {
      const ctx = await getHouseholdContext(rule.userId);
      await executeTransfer(rule.fromAccountId, rule.toAccountId, rule.amount, ctx.memberIds, ctx.budgetOwnerId);
      await prisma.recurringTransfer.update({
        where: { id: rule.id },
        data: { lastRunAt: referenceDate, lastRunCycle: currentCycle },
      });
      results.push({ ruleId: rule.id, ok: true });
    } catch (error) {
      console.error(`Recurring Transfer Error (rule ${rule.id}):`, error);
      results.push({ ruleId: rule.id, ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  return {
    processed: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}
