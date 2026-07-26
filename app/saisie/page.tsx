import { prisma } from '@/lib/prisma';
import SaisieEntryPanel from '@/app/components/SaisieEntryPanel';
import HistoryTable from '@/app/components/HistoryTable';
import CsvImportPanel from '@/app/components/CsvImportPanel';
import { Database } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { getTransactionsPage } from '@/lib/transactions';
import { getUserLocale } from '@/lib/getLocale';
import { t } from '@/lib/i18n';
import { getHouseholdContext } from '@/lib/household';
import { getFeatureStatusForUser } from '@/lib/features';
import FeatureDisabledNotice from '@/app/components/FeatureDisabledNotice';

export const dynamic = 'force-dynamic';

export default async function SaisiePage() {
  const { userId } = await requireSession();
  const featureStatus = await getFeatureStatusForUser('transactions', userId);
  if (!featureStatus.allowed) {
    return <FeatureDisabledNotice featureName="Saisie & Historique" message={featureStatus.message} />;
  }
  const locale = await getUserLocale(userId);
  const ctx = await getHouseholdContext(userId);
  const [categories, accounts, { transactions, total, summary }] = await Promise.all([
    prisma.category.findMany({
      where: { userId: ctx.budgetOwnerId },
      orderBy: { name: 'asc' },
      include: {
        subCategories: { orderBy: { name: 'asc' } },
      },
    }),
    prisma.account.findMany({
      where: { userId: { in: ctx.memberIds } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    }),
    getTransactionsPage(ctx.memberIds, { limit: 50 }),
  ]);

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
              <h1 className="text-xl font-bold tracking-tight uppercase text-ink">{t(locale, 'saisie.dbTitle')}</h1>
              <p className="text-[10px] font-bold text-subtle uppercase tracking-widest mt-0.5">
                {t(locale, 'saisie.dbSubtitle')}
              </p>
            </div>
          </div>
        </header>

        {/* Scan de reçu + Saisie manuelle */}
        <SaisieEntryPanel categories={categories} />

        {/* Import CSV — alternative aux webhooks iOS pour Android / banques sans notif exploitable */}
        <CsvImportPanel accounts={accounts} />

        {/* History Table */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
            <h2 className="text-lg font-bold tracking-tight text-ink">{t(locale, 'saisie.historyAudit')}</h2>
          </div>
          <HistoryTable
            initialTransactions={transactions}
            initialTotal={total}
            initialSummary={summary}
            categories={categories}
          />
        </div>
      </div>
    </main>
  );
}
