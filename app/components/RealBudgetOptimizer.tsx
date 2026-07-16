'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Calendar, History, RefreshCw, HelpCircle } from 'lucide-react';

interface RealBudgetCategory {
  categoryId: string;
  categoryName: string;
  ciblePct: number;
  spent: number;
  realPct: number;
  isOverBudget: boolean;
}

interface RealBudgetSummary {
  totalAnalyzed: number;
  transactionCount: number;
  categories: RealBudgetCategory[];
}

interface Props {
  onApply: (allocations: { id: string; budgetPct: number }[]) => void;
}

const formatCUR = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 2 }).format(val);

const CURRENT_MONTH_LABEL = new Date().toLocaleDateString('fr-FR', { month: 'long' });

export default function RealBudgetOptimizer({ onApply }: Props) {
  const [period, setPeriod] = useState<'month' | 'all'>('month');
  const [data, setData] = useState<RealBudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/settings/real-budget?period=${period}`)
      .then((res) => res.json())
      .then((result) => {
        if (!cancelled && result.success) setData(result.data);
      })
      .catch((err) => console.error('Real budget fetch error:', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [period]);

  const handleApply = () => {
    if (!data) return;
    onApply(data.categories.map((c) => ({ id: c.categoryId, budgetPct: c.realPct })));
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-8 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold text-ink tracking-tight">Optimisateur de Budget Réel</h3>
          </div>
          <p className="text-[12px] text-muted leading-relaxed">
            La vie à Tanger change chaque mois. Ne laissez pas votre budget statique ! Calculez une répartition
            automatiquement adaptée à vos vraies dépenses.
          </p>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-subtle mb-2">
            Sélection de la période réelle
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setLoading(true);
                setPeriod('month');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                period === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-page text-muted border border-line hover:text-body'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Ce Mois ({CURRENT_MONTH_LABEL})
            </button>
            <button
              onClick={() => {
                setLoading(true);
                setPeriod('all');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                period === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-page text-muted border border-line hover:text-body'
              }`}
            >
              <History className="w-4 h-4" />
              Historique Global
            </button>
          </div>
        </div>

        {loading || !data ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-3 bg-surface-alt rounded w-full" />
            <div className="h-3 bg-surface-alt rounded w-5/6" />
            <div className="h-3 bg-surface-alt rounded w-4/6" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Total dépensé/épargné analysé :</span>
              <span className="font-bold text-ink">{formatCUR(data.totalAnalyzed)}</span>
            </div>
            <div className="flex items-center justify-between text-sm -mt-3">
              <span className="text-muted">Flux de transactions analysés :</span>
              <span className="font-bold text-blue-400">{data.transactionCount} enregistrements</span>
            </div>

            <div>
              <div className="grid grid-cols-3 text-[10px] font-bold uppercase tracking-widest text-subtle pb-2 border-b border-line-subtle">
                <span>Enveloppe</span>
                <span className="text-right">Cible</span>
                <span className="text-right">Réel</span>
              </div>
              <div className="max-h-[280px] overflow-y-auto divide-y divide-line-subtle/50">
                {data.categories.map((c) => (
                  <div key={c.categoryId} className="grid grid-cols-3 items-center py-3 gap-2">
                    <div>
                      <p className="text-[13px] font-semibold text-body truncate">{c.categoryName}</p>
                      <p className="text-[10px] text-subtle">Déboursé : {formatCUR(c.spent)}</p>
                      {c.isOverBudget && (
                        <span className="inline-block mt-1 text-[9px] font-bold uppercase text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
                          Dépassement {period === 'all' ? 'récurrent' : 'ce mois'}
                        </span>
                      )}
                    </div>
                    <span className="text-right text-[13px] text-subtle">{c.ciblePct.toFixed(1)}%</span>
                    <span
                      className={`text-right text-[13px] font-bold ${c.isOverBudget ? 'text-red-400' : 'text-amber-400'}`}
                    >
                      {c.realPct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleApply}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-ink font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all transform active:scale-95 text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Adapter à mes Dépenses Réelles
            </button>
            <p className="text-[10px] text-subtle text-center -mt-3">
              Clique pour copier la répartition de tes dépenses et charger les pourcentages ci-dessus.
            </p>
          </>
        )}
      </div>

      <div className="bg-surface rounded-2xl border border-line p-6">
        <div className="flex items-center gap-2 mb-3">
          <HelpCircle className="w-4 h-4 text-subtle" />
          <h4 className="text-sm font-bold text-body">Pourquoi adapter ses paramètres ?</h4>
        </div>
        <p className="text-[12px] text-muted leading-relaxed">
          Les théories budgétaires imposent un cadre fixe. En réalité, un étudiant, un cadre à la zone franche, ou un
          travailleur à distance à Tanger n&apos;a pas la même structure de coûts.
        </p>
        <p className="text-[12px] text-muted leading-relaxed mt-2">
          Ajuster vos objectifs pour correspondre à vos dépenses réelles vous évite de culpabiliser sur des objectifs
          inadaptés, tout en maintenant la contrainte de bouclage à 100%.
        </p>
      </div>
    </div>
  );
}
