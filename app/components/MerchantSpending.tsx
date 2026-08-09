'use client';

import { Store } from 'lucide-react';
import type { MerchantSpending as MerchantSpendingRow } from '@/lib/financials';

interface Props {
  data: MerchantSpendingRow[];
}

const formatCUR = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

// Complète CategoryTrends : une catégorie générique ("Courses") peut masquer
// qu'un seul marchand y pèse disproportionnellement — voir
// lib/financials.ts::getTopMerchants.
export default function MerchantSpending({ data }: Props) {
  const maxTotal = Math.max(...data.map((m) => m.total), 1);

  return (
    <div className="bg-surface rounded-2xl border border-line p-8 shadow-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-bold text-ink tracking-tight">Top Marchands du Semestre</h2>
        </div>
        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded uppercase font-bold tracking-widest border border-blue-500/20">
          Cumul 6 mois
        </span>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-subtle italic">Pas encore assez de données pour établir un classement.</p>
      ) : (
        <div className="space-y-4">
          {data.map((m, i) => (
            <div key={m.merchant} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-black text-faint shrink-0">#{i + 1}</span>
                  <span className="text-xs font-semibold text-body truncate">{m.merchant}</span>
                  <span className="text-[10px] text-faint shrink-0">
                    · {m.count} transaction{m.count > 1 ? 's' : ''} · {m.dominantCategory}
                  </span>
                </div>
                <span className="text-xs font-mono text-body-soft shrink-0">{formatCUR(m.total)}</span>
              </div>
              <div className="w-full bg-surface-alt h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500/70"
                  style={{ width: `${Math.max((m.total / maxTotal) * 100, 3)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
