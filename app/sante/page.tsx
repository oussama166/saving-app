import { prisma } from "@/lib/prisma";
import {
  getUserSettings,
  getHealthBudget,
  getHealthSpendingTrend,
} from "@/lib/financials";
import HealthBudgetCard from "../components/HealthBudgetCard";
import HealthSpendingTrend from "../components/HealthSpendingTrend";
import ReimbursementSummary from "../components/ReimbursementSummary";
import PreventionCoverage from "../components/PreventionCoverage";
import MedicalRecordsTable from "../components/MedicalRecordsTable";
import { requireSession } from "@/lib/auth";
import { getUserLocale } from "@/lib/getLocale";
import { t } from "@/lib/i18n";
import { getHouseholdContext } from "@/lib/household";
import { getFeatureStatusForUser } from "@/lib/features";
import FeatureDisabledNotice from "../components/FeatureDisabledNotice";
export const dynamic = "force-dynamic";

export default async function SantePage() {
  const { userId } = await requireSession();
  const featureStatus = await getFeatureStatusForUser("health", userId);
  if (!featureStatus.allowed) {
    return <FeatureDisabledNotice featureName="Santé" message={featureStatus.message} />;
  }
  const locale = await getUserLocale(userId);
  const ctx = await getHouseholdContext(userId);
  const { referenceIncome } = await getUserSettings(ctx);
  const [budget, spendingTrend, records] = await Promise.all([
    getHealthBudget(ctx, referenceIncome),
    getHealthSpendingTrend(ctx, 6),
    prisma.medicalRecord.findMany({
      where: { userId: { in: ctx.memberIds } },
      orderBy: { date: "desc" },
      include: {
        transaction: { select: { id: true, merchant: true, amount: true } },
      },
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

  const pendingRecords = recordsForTable.filter(
    (r) => r.reimbursementStatus === "PENDING",
  );
  const pendingReimbursementTotal = pendingRecords.reduce(
    (acc, r) => acc + r.amount,
    0,
  );

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 font-sans bg-page text-body">
      <div className="mx-auto space-y-10 max-w-7xl">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            {t(locale, "health.title")}
          </h1>
          <p className="mt-1 text-sm italic text-subtle">
            {t(locale, "health.title.sub")}
          </p>
        </header>

        <div className="grid items-start grid-cols-1 gap-8 lg:grid-cols-3">
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
