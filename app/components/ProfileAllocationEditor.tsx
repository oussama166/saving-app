'use client';

import { Check, Save, AlertTriangle } from 'lucide-react';

export interface AllocationRow {
  id: string;
  name: string;
  budgetPct: number;
}

interface Props {
  referenceIncome: number;
  onReferenceIncomeChange: (value: number) => void;
  allocations: AllocationRow[];
  onAllocationChange: (id: string, pct: number) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}

const formatCUR = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 2 }).format(val);

export default function ProfileAllocationEditor({
  referenceIncome,
  onReferenceIncomeChange,
  allocations,
  onAllocationChange,
  onSave,
  saving,
  saved,
}: Props) {
  const totalPct = allocations.reduce((acc, a) => acc + a.budgetPct, 0);
  const isValid = Math.abs(totalPct - 100) < 0.5;

  return (
    <div className="bg-surface rounded-2xl border border-line p-8 space-y-8">
      {/* Revenu de référence */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-ink">Revenu Mensuel Net de Référence</h3>
          <p className="text-[12px] text-subtle mt-0.5">Base de calcul pour toutes les enveloppes.</p>
        </div>
        <div className="flex items-center gap-2 bg-page border border-line rounded-xl px-4 py-2.5">
          <input
            type="number"
            min={0}
            step={100}
            value={referenceIncome}
            onChange={(e) => onReferenceIncomeChange(Number(e.target.value))}
            className="bg-transparent text-blue-400 font-bold text-xl w-32 text-right outline-none"
          />
          <span className="text-subtle font-bold text-sm">DH</span>
        </div>
      </div>

      {/* Allocations */}
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-bold text-ink">Allocations Enregistrées (%)</h3>
            <p className="text-[12px] text-subtle mt-0.5">Chaque enveloppe est un pourcentage du revenu de référence.</p>
          </div>
          <span
            className={`text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${
              isValid
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : 'text-red-400 bg-red-500/10 border-red-500/20'
            }`}
          >
            {isValid ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            Total alloué : {totalPct.toFixed(1)}%
          </span>
        </div>

        <div className="max-h-[420px] overflow-y-auto pr-2 space-y-4">
          {allocations.map((a) => (
            <div key={a.id} className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-body">{a.name}</span>
                <span className="text-xs text-subtle font-mono">{formatCUR((a.budgetPct / 100) * referenceIncome)}</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={a.budgetPct}
                  onChange={(e) => onAllocationChange(a.id, Number(e.target.value))}
                  className="flex-1 h-1.5 bg-surface-strong rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex items-center gap-1 bg-page border border-line rounded-lg px-2 py-1.5 w-20 justify-center">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={a.budgetPct}
                    onChange={(e) => onAllocationChange(a.id, Number(e.target.value))}
                    className="bg-transparent text-emerald-400 font-bold text-sm w-10 text-right outline-none"
                  />
                  <span className="text-subtle text-[11px]">%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-between gap-4 pt-2 border-t border-line-subtle">
        <p className="text-[12px] text-subtle">
          {saved ? (
            <span className="text-emerald-400 font-semibold">Configuration enregistrée !</span>
          ) : isValid ? (
            'Prêt à être sauvegardé !'
          ) : (
            'Ajustez les % jusqu\'à atteindre 100% pour sauvegarder.'
          )}
        </p>
        <button
          onClick={onSave}
          disabled={!isValid || saving}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-6 rounded-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4" />
              Enregistrer la Configuration
            </>
          )}
        </button>
      </div>
    </div>
  );
}
