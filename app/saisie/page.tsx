import { prisma } from '@/lib/prisma';
import TransactionForm from '@/app/components/TransactionForm';
import HistoryTable from '@/app/components/HistoryTable';
import { Database } from 'lucide-react';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function SaisiePage() {
  const { userId } = await requireSession();
  const [categories, transactions] = await Promise.all([
    prisma.category.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    }),
    prisma.transaction.findMany({
      where: { userId },
      take: 50,
      orderBy: { date: 'desc' },
      include: {
        category: true,
        account: true,
      },
    }),
  ]);

  return (
    <main className="min-h-screen bg-[#131b2c] text-slate-200 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <header className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/20">
              <Database className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight uppercase text-white">Base de données transactions</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                Flux financier & Archivage
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
            <h2 className="text-lg font-bold tracking-tight text-white">Historique & Audit</h2>
          </div>
          <HistoryTable transactions={transactions} />
        </div>
      </div>
    </main>
  );
}
