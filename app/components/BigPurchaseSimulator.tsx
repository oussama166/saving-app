'use client';

import { useMemo, useState } from 'react';
import { Home, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { loanMonthlyPayment } from '@/lib/simulators';

const formatCUR = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

interface Props {
  referenceIncome: number;
}

// Impact d'un gros achat financé à crédit (immobilier, voiture...) sur le
// budget mensuel — même formule d'annuité que le remboursement de dette,
// mais orientée "avant achat" : compare la mensualité résultante au seuil
// d'endettement de 33% déjà utilisé par la règle "Crédit Consommation" de
// l'onglet Règles d'Or, pour une lecture cohérente entre les deux onglets.
export default function BigPurchaseSimulator({ referenceIncome }: Props) {
  const [purchasePrice, setPurchasePrice] = useState(300000);
  const [downPaymentPct, setDownPaymentPct] = useState(20);
  const [annualRatePct, setAnnualRatePct] = useState(6);
  const [months, setMonths] = useState(60);

  const downPayment = (purchasePrice * downPaymentPct) / 100;
  const financedAmount = purchasePrice - downPayment;

  const monthlyPayment = useMemo(
    () => loanMonthlyPayment(financedAmount, annualRatePct, months),
    [financedAmount, annualRatePct, months],
  );

  const debtThreshold = referenceIncome * 0.33;
  const incomeSharePct = referenceIncome > 0 ? Math.round((monthlyPayment / referenceIncome) * 100) : 0;
  const overThreshold = monthlyPayment > debtThreshold;
  const totalPaid = monthlyPayment * months;
  const totalInterest = totalPaid - financedAmount;

  return (
    <div className="bg-surface rounded-2xl border border-line p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Home className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h3 className="text-base font-bold text-ink tracking-tight">Gros Achat (immobilier, voiture...)</h3>
          <p className="text-[12px] text-subtle">Impact d&apos;un crédit sur ton budget mensuel.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">Prix d&apos;achat</label>
            <span className="text-sm font-bold text-ink">{formatCUR(purchasePrice)}</span>
          </div>
          <input
            type="range"
            min="20000"
            max="3000000"
            step="10000"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(Number(e.target.value))}
            className="w-full h-1.5 bg-surface-strong rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">Apport</label>
            <span className="text-sm font-bold text-ink">
              {downPaymentPct}% ({formatCUR(downPayment)})
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="80"
            step="5"
            value={downPaymentPct}
            onChange={(e) => setDownPaymentPct(Number(e.target.value))}
            className="w-full h-1.5 bg-surface-strong rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">Taux annuel du crédit</label>
            <span className="text-sm font-bold text-ink">{annualRatePct}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="15"
            step="0.25"
            value={annualRatePct}
            onChange={(e) => setAnnualRatePct(Number(e.target.value))}
            className="w-full h-1.5 bg-surface-strong rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">Durée du crédit</label>
            <span className="text-sm font-bold text-ink">
              {Math.floor(months / 12)} an{Math.floor(months / 12) > 1 ? 's' : ''}
            </span>
          </div>
          <input
            type="range"
            min="12"
            max="300"
            step="12"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="w-full h-1.5 bg-surface-strong rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-surface-deep/50 border border-line/50">
          <p className="text-[10px] text-subtle font-bold uppercase tracking-widest mb-1">Montant financé</p>
          <p className="text-lg font-black text-ink">{formatCUR(financedAmount)}</p>
        </div>
        <div className="p-5 rounded-xl bg-surface-deep/50 border border-line/50">
          <p className="text-[10px] text-subtle font-bold uppercase tracking-widest mb-1">Intérêts totaux</p>
          <p className="text-lg font-black text-ink">{formatCUR(Math.max(totalInterest, 0))}</p>
        </div>
        <div className={`p-5 rounded-xl border ${overThreshold ? 'bg-red-600/10 border-red-500/20' : 'bg-emerald-600/10 border-emerald-500/20'}`}>
          <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${overThreshold ? 'text-red-400' : 'text-emerald-400'}`}>
            Mensualité
          </p>
          <p className={`text-lg font-black ${overThreshold ? 'text-red-400' : 'text-emerald-400'}`}>
            {formatCUR(monthlyPayment)}
          </p>
        </div>
      </div>

      <div className={`p-4 rounded-xl border flex items-start gap-2.5 ${overThreshold ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
        {overThreshold ? (
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        )}
        <p className={`text-[13px] ${overThreshold ? 'text-red-400' : 'text-emerald-400'}`}>
          Cette mensualité représente {incomeSharePct}% de ton revenu de référence
          {overThreshold
            ? ` — au-delà du seuil de 33% d'endettement (règle du Crédit Consommation).`
            : ` — sous le seuil de 33% d'endettement recommandé.`}
        </p>
      </div>
    </div>
  );
}
