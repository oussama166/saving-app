'use client';

import { useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { requiredMonthlyContribution } from '@/lib/simulators';

const formatCUR = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

// Simulateur "combien épargner par mois pour atteindre X dans Y mois" —
// formule d'annuité standard (voir lib/simulators.ts), aucun appel réseau.
// Volontairement en saisie libre (pas de lien avec un SavingsGoal existant)
// pour rester utilisable même sans objectif déjà créé sur la page Objectifs.
export default function GoalSimulator() {
  const [targetAmount, setTargetAmount] = useState(50000);
  const [currentAmount, setCurrentAmount] = useState(0);
  const [months, setMonths] = useState(24);
  const [annualRatePct, setAnnualRatePct] = useState(2);

  const requiredPmt = useMemo(
    () => requiredMonthlyContribution(targetAmount, currentAmount, months, annualRatePct),
    [targetAmount, currentAmount, months, annualRatePct],
  );

  const years = Math.floor(months / 12);
  const remMonths = months % 12;

  return (
    <div className="bg-surface rounded-2xl border border-line p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <Target className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-base font-bold text-ink tracking-tight">Simulateur d&apos;Objectif</h3>
          <p className="text-[12px] text-subtle">Combien épargner par mois pour atteindre un montant cible.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">Montant cible</label>
            <span className="text-sm font-bold text-ink">{formatCUR(targetAmount)}</span>
          </div>
          <input
            type="range"
            min="1000"
            max="1000000"
            step="1000"
            value={targetAmount}
            onChange={(e) => setTargetAmount(Number(e.target.value))}
            className="w-full h-1.5 bg-surface-strong rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">Déjà épargné</label>
            <span className="text-sm font-bold text-ink">{formatCUR(currentAmount)}</span>
          </div>
          <input
            type="range"
            min="0"
            max={targetAmount}
            step="500"
            value={Math.min(currentAmount, targetAmount)}
            onChange={(e) => setCurrentAmount(Number(e.target.value))}
            className="w-full h-1.5 bg-surface-strong rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">Délai</label>
            <span className="text-sm font-bold text-ink">
              {years > 0 ? `${years} an${years > 1 ? 's' : ''} ` : ''}
              {remMonths > 0 ? `${remMonths} mois` : years > 0 ? '' : '0 mois'}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="240"
            step="1"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="w-full h-1.5 bg-surface-strong rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div className="space-y-2">
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
            className="w-full h-1.5 bg-surface-strong rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <p className="text-[10px] text-faint">
            0% = compte courant/carnet · ~2% = épargne réglementée · ~4-7% = placements diversifiés
          </p>
        </div>
      </div>

      <div className="p-5 rounded-xl bg-blue-600/10 border border-blue-500/20">
        {requiredPmt === null ? (
          <p className="text-sm text-emerald-400 font-bold">
            Objectif déjà atteint avec le montant déjà épargné — aucun versement supplémentaire nécessaire.
          </p>
        ) : (
          <>
            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-1">
              Versement mensuel nécessaire
            </p>
            <p className="text-2xl font-black text-blue-400">{formatCUR(requiredPmt)} / mois</p>
          </>
        )}
      </div>
    </div>
  );
}
