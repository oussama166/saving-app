import { prisma } from '@/lib/prisma';
import TransactionForm from '@/app/components/TransactionForm';
import HistoryTable from '@/app/components/HistoryTable';
import { Database } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { getTransactionsPage } from '@/lib/transactions';
import { getUserLocale } from '@/lib/getLocale';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function SaisiePage() {
  const { userId } = await requireSession();
  const locale = await getUserLocale(userId);
  const [categories, { transactions, total, summary }] = await Promise.all([
    prisma.category.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: {
        subCategories: { orderBy: { name: 'asc' } },
      },
    }),
    getTransactionsPage(userId, { limit: 50 }),
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

        {/* Manual Entry Form */}
        <TransactionForm categories={categories} />

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
