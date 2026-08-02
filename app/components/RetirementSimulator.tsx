'use client';

import { useMemo, useState } from 'react';
import { PiggyBank } from 'lucide-react';
import { requiredCapitalForPassiveIncome, monthsToReachCapital } from '@/lib/simulators';

const formatCUR = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

function formatMonths(months: number): string {
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem} mois`;
  if (rem === 0) return `${years} an${years > 1 ? 's' : ''}`;
  return `${years} an${years > 1 ? 's' : ''} ${rem} mois`;
}

interface Props {
  initialCapital?: number;
}

// Capital nécessaire pour un revenu passif cible (règle des 4%, ajustable) +
// temps pour l'atteindre au rythme d'épargne actuel — simulation itérative,
// voir lib/simulators.ts. `initialCapital` préremplit avec la valeur actuelle
// du portefeuille (déjà connue de la page Coach IA) plutôt que de repartir
// de zéro.
export default function RetirementSimulator({ initialCapital = 0 }: Props) {
  const [desiredMonthlyIncome, setDesiredMonthlyIncome] = useState(8000);
  const [withdrawalRatePct, setWithdrawalRatePct] = useState(4);
  const [currentAmount, setCurrentAmount] = useState(Math.round(initialCapital));
  const [monthlyContribution, setMonthlyContribution] = useState(2000);
  const [annualRatePct, setAnnualRatePct] = useState(6);

  const capitalNeeded = useMemo(
    () => requiredCapitalForPassiveIncome(desiredMonthlyIncome, withdrawalRatePct),
    [desiredMonthlyIncome, withdrawalRatePct],
  );

  const projection = useMemo(
    () => monthsToReachCapital(currentAmount, monthlyContribution, annualRatePct, capitalNeeded),
    [currentAmount, monthlyContribution, annualRatePct, capitalNeeded],
  );

  return (
    <div className="bg-surface rounded-2xl border border-line p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20">
          <PiggyBank className="w-5 h-5 text-teal-400" />
        </div>
        <div>
          <h3 className="text-base font-bold text-ink tracking-tight">Retraite / Indépendance Financière</h3>
          <p className="text-[12px] text-subtle">
            Capital nécessaire pour un revenu passif cible, selon la règle des 4%.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">Revenu passif visé</label>
            <span className="text-sm font-bold text-ink">{formatCUR(desiredMonthlyIncome)}/mois</span>
          </div>
          <input
            type="range"
            min="1000"
            max="50000"
            step="500"
            value={desiredMonthlyIncome}
            onChange={(e) => setDesiredMonthlyIncome(Number(e.target.value))}
            className="w-full h-1.5 bg-surface-strong rounded-lg appearance-none cursor-pointer accent-teal-500"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">Taux de retrait annuel</label>
            <span className="text-sm font-bold text-ink">{withdrawalRatePct}%</span>
          </div>
          <input
            type="range"
            min="2"
            max="8"
            step="0.5"
            value={withdrawalRatePct}
            onChange={(e) => setWithdrawalRatePct(Number(e.target.value))}
            className="w-full h-1.5 bg-surface-strong rounded-lg appearance-none cursor-pointer accent-teal-500"
          />
          <p className="text-[10px] text-faint">4% = référence classique (règle des 4%), plus prudent en dessous.</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">Capital déjà investi</label>
            <span className="text-sm font-bold text-ink">{formatCUR(currentAmount)}</span>
          </div>
          <input
            type="range"
            min="0"
            max={Math.max(capitalNeeded, 100000)}
            step="1000"
            value={Math.min(currentAmount, capitalNeeded)}
            onChange={(e) => setCurrentAmount(Number(e.target.value))}
            className="w-full h-1.5 bg-surface-strong rounded-lg appearance-none cursor-pointer accent-teal-500"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">Épargne mensuelle actuelle</label>
            <span className="text-sm font-bold text-ink">{formatCUR(monthlyContribution)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="20000"
            step="100"
            value={monthlyContribution}
            onChange={(e) => setMonthlyContribution(Number(e.target.value))}
            className="w-full h-1.5 bg-surface-strong rounded-lg appearance-none cursor-pointer accent-teal-500"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">Rendement annuel estimé</label>
            <span className="text-sm font-bold text-ink">{annualRatePct}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="15"
            step="0.5"
            value={annualRatePct}
            onChange={(e) => setAnnualRatePct(Number(e.target.value))}
            className="w-full h-1.5 bg-surface-strong rounded-lg appearance-none cursor-pointer accent-teal-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-teal-600/10 border border-teal-500/20">
          <p className="text-[10px] text-teal-400 font-bold uppercase tracking-widest mb-1">Capital nécessaire</p>
          <p className="text-2xl font-black text-teal-400">{formatCUR(capitalNeeded)}</p>
        </div>

        <div className="p-5 rounded-xl bg-surface-deep/50 border border-line/50">
          <p className="text-[10px] text-subtle font-bold uppercase tracking-widest mb-1">
            Temps pour l&apos;atteindre à ce rythme
          </p>
          {projection ? (
            <p className="text-2xl font-black text-ink">
              {projection.months === 0 ? 'Déjà atteint' : formatMonths(projection.months)}
            </p>
          ) : (
            <p className="text-sm text-red-400 font-bold">
              Pas atteignable dans un horizon raisonnable — augmente l&apos;épargne mensuelle ou le rendement.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
