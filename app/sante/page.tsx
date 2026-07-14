import React from 'react';
import { prisma } from '@/lib/prisma';
import { getUserSettings, getHealthBudget, getHealthSpendingTrend } from '@/lib/financials';
import HealthBudgetCard from '../components/HealthBudgetCard';
import HealthSpendingTrend from '../components/HealthSpendingTrend';
import ReimbursementSummary from '../components/ReimbursementSummary';
import PreventionCoverage from '../components/PreventionCoverage';
import MedicalRecordsTable from '../components/MedicalRecordsTable';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function SantePage() {
  const { userId } = await requireSession();
  const { referenceIncome } = await getUserSettings(userId);
  const [budget, spendingTrend, records] = await Promise.all([
    getHealthBudget(userId, referenceIncome),
    getHealthSpendingTrend(userId, 6),
    prisma.medicalRecord.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      include: { transaction: { select: { id: true, merchant: true, amount: true } } },
    }),
  ]);

  const recordsForTable = records.map((r) => ({
    id: r.id,
    provider: r.provider,
    amount: r.amount,
    date: r.date.toISOString(),
    reimbursementStatus: r.reimbursementStatus,
    transaction: r.transaction,
  }));

  const pendingRecords = recordsForTable.filter((r) => r.reimbursementStatus === 'PENDING');
  const pendingReimbursementTotal = pendingRecords.reduce((acc, r) => acc + r.amount, 0);

  return (
    <main className="min-h-screen bg-[#131b2c] p-8 text-slate-200 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-white">Santé</h1>
          <p className="text-slate-500 text-sm mt-1 italic">
            Suivez votre budget santé et vos dossiers de remboursement CNSS.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2">
            <HealthBudgetCard budget={budget} />
          </div>
          <ReimbursementSummary records={recordsForTable} />
        </div>

        <HealthSpendingTrend data={spendingTrend} />

        <PreventionCoverage
          spentThisMonth={budget.spentThisMonth}
          weightOnIncomePct={budget.weightOnIncomePct}
          remaining={budget.remaining}
          pendingReimbursementTotal={pendingReimbursementTotal}
          pendingCount={pendingRecords.length}
          recordsCount={recordsForTable.length}
        />

        <MedicalRecordsTable records={recordsForTable} />
      </div>
    </main>
  );
}
