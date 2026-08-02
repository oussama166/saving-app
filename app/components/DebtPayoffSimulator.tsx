'use client';

import { useEffect, useMemo, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { simulateDebtPayoff } from '@/lib/simulators';

const formatCUR = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

interface DebtOption {
  id: string;
  name: string;
  currentBalance: number;
  interestRate: number;
  monthlyPayment: number;
}

function formatMonths(months: number): string {
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem} mois`;
  if (rem === 0) return `${years} an${years > 1 ? 's' : ''}`;
  return `${years} an${years > 1 ? 's' : ''} ${rem} mois`;
}

// Comparaison mensualité minimale vs accélérée pour une dette existante —
// tente de préremplir depuis /api/debts (si la fonctionnalité Dettes est
// active et qu'il existe au moins une dette active), sinon reste en saisie
// libre. Simulation itérative mois par mois (voir lib/simulators.ts), aucun
// appel IA.
export default function DebtPayoffSimulator() {
  const [debts, setDebts] = useState<DebtOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>('manual');
  const [balance, setBalance] = useState(50000);
  const [annualRatePct, setAnnualRatePct] = useState(8);
  const [minPayment, setMinPayment] = useState(1500);
  const [acceleratedPayment, setAcceleratedPayment] = useState(2500);

  useEffect(() => {
    fetch('/api/debts')
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (result?.success) {
          const active = (result.data as (DebtOption & { isActive: boolean })[]).filter(
            (d) => d.isActive && d.currentBalance > 0,
          );
          setDebts(active);
        }
      })
      .catch(() => {
        // Fonctionnalité Dettes désactivée ou pas de session — la
        // simulation reste utilisable en saisie manuelle.
      });
  }, []);

  const applyDebt = (id: string) => {
    setSelectedId(id);
    const debt = debts.find((d) => d.id === id);
    if (debt) {
      setBalance(debt.currentBalance);
      setAnnualRatePct(debt.interestRate);
      setMinPayment(debt.monthlyPayment || Math.round(debt.currentBalance / 24));
      setAcceleratedPayment(Math.round((debt.monthlyPayment || debt.currentBalance / 24) * 1.5));
    }
  };

  const minScenario = useMemo(
    () => simulateDebtPayoff(balance, annualRatePct, minPayment),
    [balance, annualRatePct, minPayment],
  );
  const acceleratedScenario = useMemo(
    () => simulateDebtPayoff(balance, annualRatePct, acceleratedPayment),
    [balance, annualRatePct, acceleratedPayment],
  );

  return (
    <div className="bg-surface rounded-2xl border border-line p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
          <CreditCard className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h3 className="text-base font-bold text-ink tracking-tight">Remboursement de Dette</h3>
          <p className="text-[12px] text-subtle">Mensualité minimale vs accélérée : temps et intérêts économisés.</p>
        </div>
      </div>

      {debts.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted uppercase tracking-widest">Dette (optionnel)</label>
          <select
            value={selectedId}
            onChange={(e) => applyDebt(e.target.value)}
            className="w-full bg-page border border-line text-body rounded-lg p-2.5 text-sm focus:border-red-500 outline-none"
          >
            <option value="manual">Saisie manuelle</option>
            {debts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} — {formatCUR(d.currentBalance)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">Solde restant dû</label>
            <span className="text-sm font-bold text-ink">{formatCUR(balance)}</span>
          </div>
          <input
            type="range"
            min="1000"
            max="1000000"
            step="1000"
            value={balance}
            onChange={(e) => setBalance(Number(e.target.value))}
            className="w-full h-1.5 bg-surface-strong rounded-lg appearance-none cursor-pointer accent-red-500"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">Taux annuel</label>
            <span className="text-sm font-bold text-ink">{annualRatePct}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="25"
            step="0.5"
            value={annualRatePct}
            onChange={(e) => setAnnualRatePct(Number(e.target.value))}
            className="w-full h-1.5 bg-surface-strong rounded-lg appearance-none cursor-pointer accent-red-500"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">Mensualité minimale</label>
            <span className="text-sm font-bold text-ink">{formatCUR(minPayment)}</span>
          </div>
          <input
            type="range"
            min="100"
            max={Math.max(balance / 2, 500)}
            step="100"
            value={minPayment}
            onChange={(e) => setMinPayment(Number(e.target.value))}
            className="w-full h-1.5 bg-surface-strong rounded-lg appearance-none cursor-pointer accent-red-500"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">Mensualité accélérée</label>
            <span className="text-sm font-bold text-ink">{formatCUR(acceleratedPayment)}</span>
          </div>
          <input
            type="range"
            min="100"
            max={Math.max(balance, 1000)}
            step="100"
            value={acceleratedPayment}
            onChange={(e) => setAcceleratedPayment(Number(e.target.value))}
            className="w-full h-1.5 bg-surface-strong rounded-lg appearance-none cursor-pointer accent-red-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-surface-deep/50 border border-line/50">
          <p className="text-[10px] text-subtle font-bold uppercase tracking-widest mb-2">Mensualité minimale</p>
          {minScenario ? (
            <>
              <p className="text-lg font-black text-ink">{formatMonths(minScenario.months)}</p>
              <p className="text-[12px] text-red-400 mt-1">+{formatCUR(minScenario.totalInterest)} d&apos;intérêts</p>
            </>
          ) : (
            <p className="text-[12px] text-red-400">Mensualité trop faible pour rembourser cette dette.</p>
          )}
        </div>

        <div className="p-5 rounded-xl bg-emerald-600/10 border border-emerald-500/20">
          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-2">Mensualité accélérée</p>
          {acceleratedScenario ? (
            <>
              <p className="text-lg font-black text-ink">{formatMonths(acceleratedScenario.months)}</p>
              <p className="text-[12px] text-emerald-400 mt-1">
                +{formatCUR(acceleratedScenario.totalInterest)} d&apos;intérêts
              </p>
            </>
          ) : (
            <p className="text-[12px] text-red-400">Mensualité trop faible pour rembourser cette dette.</p>
          )}
        </div>
      </div>

      {minScenario && acceleratedScenario && (
        <div className="p-4 rounded-xl bg-blue-600/10 border border-blue-500/20 text-center">
          <p className="text-sm text-blue-400 font-bold">
            En accélérant : {formatMonths(minScenario.months - acceleratedScenario.months)} de moins et{' '}
            {formatCUR(minScenario.totalInterest - acceleratedScenario.totalInterest)} d&apos;intérêts économisés.
          </p>
        </div>
      )}
    </div>
  );
}
