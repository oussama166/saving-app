import { prisma } from "@/lib/prisma";
import SaisieEntryPanel from "@/app/components/SaisieEntryPanel";
import HistoryTable from "@/app/components/HistoryTable";
import CsvImportPanel from "@/app/components/CsvImportPanel";
import AccountBalancesBanner from "@/app/components/AccountBalancesBanner";
import TransferCard from "@/app/components/TransferCard";
import QuickStatsStrip from "@/app/components/QuickStatsStrip";
import { Database } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getTransactionsPage } from "@/lib/transactions";
import { getUserLocale } from "@/lib/getLocale";
import { t } from "@/lib/i18n";
import { getHouseholdContext } from "@/lib/household";
import { getFeatureStatusForUser } from "@/lib/features";
import FeatureDisabledNotice from "@/app/components/FeatureDisabledNotice";

export const dynamic = "force-dynamic";

export default async function SaisiePage() {
  const { userId } = await requireSession();
  const featureStatus = await getFeatureStatusForUser("transactions", userId);
  if (!featureStatus.allowed) {
    return (
      <FeatureDisabledNotice
        featureName="Saisie & Historique"
        message={featureStatus.message}
      />
    );
  }
  const locale = await getUserLocale(userId);
  const ctx = await getHouseholdContext(userId);

  // Bornes pour le récap "aujourd'hui / cette semaine" (voir
  // QuickStatsStrip) — semaine calendaire commençant le lundi, indépendante
  // du cycle budgétaire (jour de paie) utilisé ailleurs dans l'app.
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = todayStart.getDay(); // 0 = dimanche
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - diffToMonday);
  const todayISO = todayStart.toISOString().split("T")[0];
  const weekStartISO = weekStart.toISOString().split("T")[0];

  const [categories, accounts, { transactions, total, summary }, todayStats, weekStats, recentMerchantRows] =
    await Promise.all([
      prisma.category.findMany({
        where: { userId: ctx.budgetOwnerId },
        orderBy: { name: "asc" },
        include: {
          subCategories: { orderBy: { name: "asc" } },
        },
      }),
      prisma.account.findMany({
        where: { userId: { in: ctx.memberIds } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          type: true,
          balance: true,
          currency: true,
        },
      }),
      getTransactionsPage(ctx.memberIds, { limit: 50 }),
      // limit: 1 — seul le `summary` (calculé sur TOUTES les lignes qui
      // matchent le filtre, pas la page) nous intéresse ici, voir
      // lib/transactions.ts.
      getTransactionsPage(ctx.memberIds, { type: "expense", dateFrom: todayISO, limit: 1 }),
      getTransactionsPage(ctx.memberIds, { type: "expense", dateFrom: weekStartISO, limit: 1 }),
      // Libellés marchands récents du foyer (voir TransactionForm) —
      // proposés en autocomplétion sur le champ description de la saisie
      // manuelle.
      prisma.transaction.findMany({
        where: { userId: { in: ctx.memberIds } },
        select: { merchant: true },
        distinct: ["merchant"],
        orderBy: { date: "desc" },
        take: 30,
      }),
    ]);
  const recentMerchants = recentMerchantRows.map((r) => r.merchant);

  return (
    <main className="min-h-screen bg-page text-body p-4 sm:p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <header className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/20">
              <Database className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight uppercase text-ink">
                {t(locale, "saisie.dbTitle")}
              </h1>
              <p className="text-[10px] font-bold text-subtle uppercase tracking-widest mt-0.5">
                {t(locale, "saisie.dbSubtitle")}
              </p>
            </div>
          </div>
        </header>

        <QuickStatsStrip todaySpent={todayStats.summary.totalExpense} weekSpent={weekStats.summary.totalExpense} locale={locale} />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SaisieEntryPanel categories={categories} accounts={accounts} recentMerchants={recentMerchants} />
          </div>
          <div className="space-y-8">
            <AccountBalancesBanner accounts={accounts} locale={locale} />
            <TransferCard />
          </div>
        </div>

        <CsvImportPanel accounts={accounts} />

        {/* History Table */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
            <h2 className="text-lg font-bold tracking-tight text-ink">
              {t(locale, "saisie.historyAudit")}
            </h2>
          </div>
          <HistoryTable
            initialTransactions={transactions}
            initialTotal={total}
            initialSummary={summary}
            categories={categories}
            accounts={accounts}
          />
        </div>
      </div>
    </main>
  );
}
