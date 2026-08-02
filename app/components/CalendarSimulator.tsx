'use client';

import { useState } from 'react';
import { FlaskConical, Loader2, ArrowRight } from 'lucide-react';
import { useLanguage } from './LanguageProvider';

interface SimulationResult {
  withinWindow: boolean;
  nextPayday: string;
  baseline: { safeDailySpendMad: number; minProjectedBalanceMad: number };
  simulated: { safeDailySpendMad: number; minProjectedBalanceMad: number };
}

const formatMAD = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

// Simulateur "et si" — rejoue /api/calendar/simulate avec une dépense
// hypothétique, sans jamais rien enregistrer. Purement un outil d'aide à la
// décision avant un achat, pas une saisie réelle (voir TransactionForm pour
// enregistrer une vraie transaction).
export default function CalendarSimulator() {
  const { t } = useLanguage();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState(false);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/calendar/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountMad: Number(amount), date }),
      });
      const json = await res.json();
      if (json.success) {
        setResult(json.data);
      } else {
        setError(true);
        setResult(null);
      }
    } catch {
      setError(true);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const deltaBudget = result ? result.simulated.safeDailySpendMad - result.baseline.safeDailySpendMad : 0;
  const deltaMin = result ? result.simulated.minProjectedBalanceMad - result.baseline.minProjectedBalanceMad : 0;
  const becomesRisky = result ? result.simulated.minProjectedBalanceMad < 0 && result.baseline.minProjectedBalanceMad >= 0 : false;

  return (
    <div className="p-6 border bg-surface rounded-2xl border-line">
      <div className="flex items-center gap-2 mb-4">
        <FlaskConical className="w-4 h-4 text-purple-400" />
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-subtle">{t('calendar.simulator.title')}</h3>
      </div>

      <form onSubmit={handleSimulate} className="space-y-2 mb-4">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder={t('calendar.simulator.amountPlaceholder')}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-page border border-line rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-page border border-line rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
          {t('calendar.simulator.simulate')}
        </button>
      </form>

      {error && <p className="text-[11px] text-red-400">{t('calendar.simulator.error')}</p>}

      {result && !result.withinWindow && (
        <p className="text-[11px] text-subtle italic">{t('calendar.simulator.outsideWindow')}</p>
      )}

      {result && result.withinWindow && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-subtle">{t('calendar.simulator.dailyBudget')}</span>
            <span className="flex items-center gap-1.5 font-bold tabular-nums">
              {formatMAD(result.baseline.safeDailySpendMad)}
              <ArrowRight className="w-3 h-3 text-faint" />
              <span className={deltaBudget < 0 ? 'text-red-400' : 'text-emerald-400'}>
                {formatMAD(result.simulated.safeDailySpendMad)}
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-subtle">{t('calendar.simulator.lowPoint')}</span>
            <span className="flex items-center gap-1.5 font-bold tabular-nums">
              {formatMAD(result.baseline.minProjectedBalanceMad)}
              <ArrowRight className="w-3 h-3 text-faint" />
              <span className={deltaMin < 0 && result.simulated.minProjectedBalanceMad < 0 ? 'text-red-400' : 'text-body'}>
                {formatMAD(result.simulated.minProjectedBalanceMad)}
              </span>
            </span>
          </div>
          {becomesRisky && (
            <div className="p-3 rounded-xl border bg-red-500/10 border-red-500/20 text-red-400 text-[11px] font-bold">
              {t('calendar.simulator.becomesRisky')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
