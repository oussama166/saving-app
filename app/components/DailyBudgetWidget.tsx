'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Gauge, ArrowRight } from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { tParams } from '@/lib/i18n';

interface TodayBudget {
  safeDailySpendMad: number;
  todaySpentMad: number;
  remainingTodayMad: number;
}

const formatMAD = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

// Carte complémentaire au "Solde Sécuritaire Global" déjà affiché dans le
// header du Dashboard (safeToSpend = solde courant − épargne bloquée,
// statique) — celle-ci vient de /api/calendar/today (lib/billCalendar.ts) et
// tient compte des échéances à venir jusqu'à la prochaine paie, recalculée
// jour par jour. Ne s'affiche que si la fonctionnalité Calendrier est
// activée pour l'utilisateur (404/403 -> composant silencieusement invisible,
// pas de fallback ni d'erreur affichée).
export default function DailyBudgetWidget() {
  const { t } = useLanguage();
  const [data, setData] = useState<TodayBudget | null>(null);

  useEffect(() => {
    fetch('/api/calendar/today')
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (result?.success) setData(result.data);
      })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const spentPct =
    data.safeDailySpendMad > 0
      ? Math.min(100, (data.todaySpentMad / data.safeDailySpendMad) * 100)
      : data.todaySpentMad > 0
        ? 100
        : 0;
  const over = data.todaySpentMad > data.safeDailySpendMad;

  return (
    <Link
      href="/calendrier"
      className="block p-6 border bg-surface-alt/50 border-line rounded-2xl hover:border-blue-500/40 transition-colors group"
    >
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-bold tracking-widest uppercase text-muted flex-1">
          {t('dashboard.dailyBudget.title')}
        </h3>
        <ArrowRight className="w-3.5 h-3.5 text-faint group-hover:text-blue-400 transition-colors" />
      </div>
      <p className={`text-2xl font-black tabular-nums ${over ? 'text-red-400' : 'text-blue-400'}`}>
        {formatMAD(Math.max(0, data.remainingTodayMad))}
      </p>
      <p className="text-[10px] uppercase font-bold tracking-widest text-subtle mb-3">
        {t('dashboard.dailyBudget.remainingToday')}
      </p>
      <div className="h-1.5 rounded-full bg-surface-alt overflow-hidden">
        <div className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${spentPct}%` }} />
      </div>
      <p className="text-[10px] text-faint mt-2">
        {tParams(t('dashboard.dailyBudget.spentOfBudget'), {
          spent: Math.round(data.todaySpentMad),
          budget: Math.round(data.safeDailySpendMad),
        })}
      </p>
    </Link>
  );
}
