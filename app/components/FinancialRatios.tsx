'use client';

import type { FinancialRatios as FinancialRatiosData } from '@/lib/financials';

interface Props {
  ratios: FinancialRatiosData;
}

const formatCUR = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

export default function FinancialRatios({ ratios }: Props) {
  const items = [
    {
      label: 'Charges Fixes',
      pct: ratios.fixedChargesRatioPct,
      amount: ratios.fixedCharges,
      target: 50,
      color: 'bg-blue-500',
      warn: ratios.fixedChargesRatioPct > 50,
    },
    {
      label: 'Épargne / Investissement',
      pct: ratios.savingsRatioPct,
      amount: ratios.savings,
      target: 20,
      color: 'bg-emerald-500',
      warn: ratios.savingsRatioPct < 20,
    },
  ];

  return (
    <div className="bg-surface rounded-2xl border border-line p-8 shadow-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-ink tracking-tight">Ratios Financiers</h2>
        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded uppercase font-bold tracking-widest border border-blue-500/20">
          Mois en cours
        </span>
      </div>

      <div className="space-y-5">
        {items.map((item) => (
          <div key={item.label} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-body-soft">{item.label}</span>
              <span className={`text-xs font-bold ${item.warn ? 'text-red-400' : 'text-body-soft'}`}>
                {item.pct}% · {formatCUR(item.amount)}
              </span>
            </div>
            <div className="w-full bg-surface-strong h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${item.color}`}
                style={{ width: `${Math.min(item.pct, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-subtle font-bold uppercase tracking-tighter">
              <span>0%</span>
              <span>Cible : {item.target}%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-surface-deep/50 rounded-xl border border-line/50 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-subtle font-bold uppercase tracking-widest">Reste à Vivre</span>
          <p className="text-[10px] text-faint italic mt-0.5">Revenu − Charges Fixes − Épargne</p>
        </div>
        <p className={`text-xl font-black ${ratios.resteAVivre < 0 ? 'text-red-400' : 'text-blue-400'}`}>
          {formatCUR(ratios.resteAVivre)}
        </p>
      </div>
    </div>
  );
}
