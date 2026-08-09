'use client';

import { useMemo, useState } from 'react';
import { ArrowDownWideNarrow, Percent, Trophy } from 'lucide-react';
import { simulateMultiDebtPayoff, type MultiDebtInput } from '@/lib/simulators';

interface DebtForComparison {
  id: string;
  name: string;
  currentBalance: number;
  interestRate: number;
  monthlyPayment: number;
}

interface Props {
  debts: DebtForComparison[];
}

const formatCUR = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

function formatMonths(months: number): string {
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem} mois`;
  if (rem === 0) return `${years} an${years > 1 ? 's' : ''}`;
  return `${years} an${years > 1 ? 's' : ''} ${rem} mois`;
}

// Compare les deux stratégies classiques de remboursement multi-dettes :
// boule de neige (solde le plus faible en premier, gains psychologiques
// rapides) vs avalanche (taux le plus élevé en premier, mathématiquement
// optimal). N'a de sens qu'à partir de 2 dettes actives — avec une seule,
// voir DebtPayoffSimulator (comparaison mensualité min vs accélérée).
export default function DebtStrategyComparison({ debts }: Props) {
  const totalMinPayments = useMemo(() => debts.reduce((acc, d) => acc + (d.monthlyPayment || 0), 0), [debts]);
  const [extraBudget, setExtraBudget] = useState(1000);

  const inputs: MultiDebtInput[] = useMemo(
    () =>
      debts.map((d) => ({
        id: d.id,
        name: d.name,
        balance: d.currentBalance,
        annualRatePct: d.interestRate,
        // Un minimum de 1% du solde si aucune mensualité indicative n'est
        // renseignée — évite une dette bloquée à 0 DH/mois dans la simulation.
        minPayment: d.monthlyPayment > 0 ? d.monthlyPayment : Math.max(d.currentBalance * 0.01, 100),
      })),
    [debts],
  );

  const snowball = useMemo(() => simulateMultiDebtPayoff(inputs, extraBudget, 'snowball'), [inputs, extraBudget]);
  const avalanche = useMemo(() => simulateMultiDebtPayoff(inputs, extraBudget, 'avalanche'), [inputs, extraBudget]);

  if (debts.length < 2) return null;

  const winner =
    snowball && avalanche
      ? avalanche.totalInterest < snowball.totalInterest
        ? 'avalanche'
        : avalanche.totalInterest > snowball.totalInterest
          ? 'snowball'
          : null
      : null;

  return (
    <div className="p-6 border bg-surface rounded-2xl border-line space-y-5">
      <div className="flex items-center gap-4">
        <div className="p-3 border bg-purple-600/20 rounded-xl border-purple-500/20">
          <Trophy className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h2 className="text-sm font-black tracking-tight uppercase text-ink">
            Boule de neige vs Avalanche
          </h2>
          <p className="text-subtle text-xs mt-0.5 max-w-md">
            Deux façons d&apos;ordonner tes {debts.length} dettes actives quand tu as un budget supplémentaire à y
            consacrer chaque mois, en plus des mensualités minimales ({formatCUR(totalMinPayments)}/mois).
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-bold text-muted uppercase tracking-widest">
            Budget supplémentaire par mois
          </label>
          <span className="text-sm font-bold text-ink">{formatCUR(extraBudget)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="10000"
          step="100"
          value={extraBudget}
          onChange={(e) => setExtraBudget(Number(e.target.value))}
          className="w-full h-1.5 bg-surface-strong rounded-lg appearance-none cursor-pointer accent-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StrategyCard
          icon={<ArrowDownWideNarrow className="w-4 h-4" />}
          title="Boule de neige"
          subtitle="Solde le plus faible d'abord"
          result={snowball}
          highlighted={winner === 'snowball'}
        />
        <StrategyCard
          icon={<Percent className="w-4 h-4" />}
          title="Avalanche"
          subtitle="Taux le plus élevé d'abord"
          result={avalanche}
          highlighted={winner === 'avalanche'}
        />
      </div>

      {winner && snowball && avalanche && (
        <div className="p-4 rounded-xl bg-blue-600/10 border border-blue-500/20 text-center">
          <p className="text-sm text-blue-400 font-bold">
            {winner === 'avalanche' ? 'Avalanche' : 'Boule de neige'} économise{' '}
            {formatCUR(Math.abs(snowball.totalInterest - avalanche.totalInterest))} d&apos;intérêts en plus
            {winner === 'snowball' && ' — la boule de neige gagne ici car tes plus petites dettes ont aussi les taux les plus élevés.'}
          </p>
        </div>
      )}
      {!winner && snowball && avalanche && (
        <p className="text-center text-xs text-subtle">Les deux stratégies coûtent le même total d&apos;intérêts ici.</p>
      )}
    </div>
  );
}

function StrategyCard({
  icon,
  title,
  subtitle,
  result,
  highlighted,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  result: ReturnType<typeof simulateMultiDebtPayoff>;
  highlighted: boolean;
}) {
  return (
    <div
      className={`p-5 rounded-xl border space-y-3 ${
        highlighted ? 'bg-emerald-600/10 border-emerald-500/20' : 'bg-surface-deep/50 border-line/50'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={highlighted ? 'text-emerald-400' : 'text-body-soft'}>{icon}</span>
        <div>
          <p className={`text-xs font-bold ${highlighted ? 'text-emerald-400' : 'text-body'}`}>{title}</p>
          <p className="text-[10px] text-faint">{subtitle}</p>
        </div>
      </div>

      {result ? (
        <>
          <div>
            <p className="text-lg font-black text-ink">{formatMonths(result.months)}</p>
            <p className="text-[12px] text-red-400 mt-0.5">+{formatCUR(result.totalInterest)} d&apos;intérêts</p>
          </div>
          <div className="space-y-1 border-t border-line-subtle pt-2">
            {result.payoffOrder.map((p, i) => (
              <p key={p.id} className="text-[11px] text-subtle">
                {i + 1}. {p.name} <span className="text-faint">(mois {p.monthPaidOff})</span>
              </p>
            ))}
          </div>
        </>
      ) : (
        <p className="text-[12px] text-red-400">Budget insuffisant pour solder ces dettes.</p>
      )}
    </div>
  );
}
