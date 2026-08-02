'use client';

import { Target } from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { tParams } from '@/lib/i18n';

interface RecentDay {
  date: string;
  safeDailySpendMad: number;
  spentMad: number;
  onBudget: boolean;
}

interface Props {
  totalDays: number;
  daysOnBudget: number;
  scorePct: number;
  worstWeekday: { key: string; overspendRatePct: number } | null;
  recentDays: RecentDay[];
}

const WEEKDAY_LABEL_KEYS: Record<string, string> = {
  sun: 'calendar.discipline.weekday.sun',
  mon: 'calendar.discipline.weekday.mon',
  tue: 'calendar.discipline.weekday.tue',
  wed: 'calendar.discipline.weekday.wed',
  thu: 'calendar.discipline.weekday.thu',
  fri: 'calendar.discipline.weekday.fri',
  sat: 'calendar.discipline.weekday.sat',
};

// Historique du respect du budget journalier (voir lib/budgetDiscipline.ts)
// — purement déterministe, basé sur DailyBudgetSnapshot. Aucune IA ici, juste
// un score et un pattern (jour de semaine le plus à risque).
export default function BudgetDisciplineCard({ totalDays, daysOnBudget, scorePct, worstWeekday, recentDays }: Props) {
  const { t } = useLanguage();

  if (totalDays === 0) {
    return (
      <div className="p-6 border bg-surface rounded-2xl border-line">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-emerald-400" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-subtle">
            {t('calendar.discipline.title')}
          </h3>
        </div>
        <p className="text-[11px] text-subtle italic">{t('calendar.discipline.notEnoughHistory')}</p>
      </div>
    );
  }

  const scoreColor = scorePct >= 70 ? 'text-emerald-400' : scorePct >= 40 ? 'text-orange-400' : 'text-red-400';

  return (
    <div className="p-6 border bg-surface rounded-2xl border-line">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-emerald-400" />
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-subtle">
          {t('calendar.discipline.title')}
        </h3>
      </div>

      <p className={`text-2xl font-black tabular-nums ${scoreColor}`}>{scorePct}%</p>
      <p className="text-[10px] uppercase font-bold tracking-widest text-subtle mb-4">
        {tParams(t('calendar.discipline.daysOnBudget'), { onBudget: daysOnBudget, total: totalDays })}
      </p>

      {recentDays.length > 0 && (
        <div className="flex items-center gap-1 mb-4">
          {recentDays.map((d) => (
            <span
              key={d.date}
              title={`${new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}: ${Math.round(d.spentMad)} / ${Math.round(d.safeDailySpendMad)} DH`}
              className={`flex-1 h-6 rounded ${d.onBudget ? 'bg-emerald-500/60' : 'bg-red-500/60'}`}
            />
          ))}
        </div>
      )}

      {worstWeekday && (
        <p className="text-[11px] text-subtle">
          {tParams(t('calendar.discipline.worstWeekday'), {
            weekday: t(WEEKDAY_LABEL_KEYS[worstWeekday.key] ?? 'calendar.discipline.weekday.sun'),
            rate: worstWeekday.overspendRatePct,
          })}
        </p>
      )}
    </div>
  );
}
