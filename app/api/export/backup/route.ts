import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getHouseholdContext } from '@/lib/household';

// Export JSON complet des données du foyer, à la demande — contrairement à
// /api/backup/archive (cron externe, archive PUIS SUPPRIME les vieilles
// transactions), cette route ne modifie rien : elle sert uniquement de
// copie de sécurité téléchargeable, déclenchée manuellement depuis Profil.
// Jamais de secret/mot de passe/token dans l'export (voir le select explicite
// sur User ci-dessous).
export async function GET() {
  try {
    const { userId } = await requireSession();
    const ctx = await getHouseholdContext(userId);
    const memberIds = ctx.memberIds;
    const budgetOwnerId = ctx.budgetOwnerId;

    const [
      users,
      accounts,
      categories,
      transactions,
      subscriptions,
      subscriptionPlanChanges,
      debts,
      debtPayments,
      savingsGoals,
      goalContributions,
      portfolioAssets,
      bills,
      recurringTransfers,
      kakeiboEntries,
      userSettings,
    ] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: memberIds } }, select: { id: true, email: true, name: true, createdAt: true } }),
      prisma.account.findMany({ where: { userId: { in: memberIds } } }),
      prisma.category.findMany({ where: { userId: budgetOwnerId }, include: { subCategories: true } }),
      prisma.transaction.findMany({ where: { userId: { in: memberIds } }, orderBy: { date: 'asc' } }),
      prisma.subscription.findMany({ where: { userId: { in: memberIds } } }),
      prisma.subscriptionPlanChange.findMany({ where: { userId: { in: memberIds } } }),
      prisma.debt.findMany({ where: { userId: { in: memberIds } } }),
      prisma.debtPayment.findMany({ where: { debt: { userId: { in: memberIds } } } }),
      prisma.savingsGoal.findMany({ where: { userId: { in: memberIds } } }),
      prisma.goalContribution.findMany({ where: { goal: { userId: { in: memberIds } } } }),
      prisma.portfolioAsset.findMany({ where: { userId: { in: memberIds } } }),
      prisma.bill.findMany({ where: { userId: { in: memberIds } } }),
      prisma.recurringTransfer.findMany({ where: { userId: { in: memberIds } } }),
      prisma.kakeiboEntry.findMany({ where: { userId: budgetOwnerId } }),
      prisma.userSettings.findUnique({ where: { userId: budgetOwnerId } }),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      format: 'wealthos-backup-v1',
      users,
      accounts,
      categories,
      transactions,
      subscriptions,
      subscriptionPlanChanges,
      debts,
      debtPayments,
      savingsGoals,
      goalContributions,
      portfolioAssets,
      bills,
      recurringTransfers,
      kakeiboEntries,
      userSettings,
    };

    const today = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="wealthos-backup-${today}.json"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Manual Backup Export Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
