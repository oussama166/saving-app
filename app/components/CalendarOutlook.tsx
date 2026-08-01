'use client';

import { Sparkles, Gauge } from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { tParams } from '@/lib/i18n';
import { useCoachAdvice } from '../hooks/useCoachAdvice';
import { calendarOutlookSchema } from '@/lib/coachSchemas';
import CoachRegenerateButton from './CoachRegenerateButton';

interface OutlookEvent {
  name: string;
  amountMad: number;
  dueDate: string;
  sourceType: string;
}

interface DailyBudgetPoint {
  date: string;
  safeDailySpendMad: number;
}

interface CategoryShare {
  categoryId: string;
  categoryName: string;
  shareMad: number;
}

interface Props {
  startBalanceMad: number;
  committedOutflowMad: number;
  safeDailySpendMad: number;
  daysRemaining: number;
  nextPayday: string;
  minProjectedBalanceMad: number;
  upcomingEvents: OutlookEvent[];
  dailySeries: DailyBudgetPoint[];
  todaySpentMad: number;
  categoryBreakdown: CategoryShare[];
}

const formatMAD = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

// Carte "Coach IA" du calendrier — le budget journalier sécuritaire affiché
// en haut est TOUJOURS le chiffre déterministe de lib/billCalendar.ts (jamais
// recalculé par le LLM, voir le principe partagé par les 5 autres sections
// Coach IA). L'IA ne fait qu'ajouter une lecture qualitative de ce chiffre.
export default function CalendarOutlook({
  startBalanceMad,
  committedOutflowMad,
  safeDailySpendMad,
  daysRemaining,
  nextPayday,
  minProjectedBalanceMad,
  upcomingEvents,
  dailySeries,
  todaySpentMad,
  categoryBreakdown,
}: Props) {
  const { t } = useLanguage();
  const { advice, loading, regenerating, failed, generatedAt, regenerate } = useCoachAdvice(
    '/api/coach/calendar-outlook',
    calendarOutlookSchema,
    {
      startBalanceMad,
      committedOutflowMad,
      safeDailySpendMad,
      daysRemaining,
      nextPayday,
      minProjectedBalanceMad,
      upcomingEvents,
      dailySeries,
      todaySpentMad,
    },
  );

  const complete = Boolean(advice?.synthese && advice?.pointAttention && advice?.recommandation);
  const risky = minProjectedBalanceMad < 0;
  // Le budget journalier est clippé à 0 dès que les échéances connues
  // dépassent le solde actuel (voir lib/billCalendar.ts) — on affiche donc
  // toujours le détail du calcul en dessous, pour que "0 DH" ne soit jamais
  // un chiffre mystère : l'utilisateur voit exactement pourquoi (échéances
  // >= solde), au lieu de croire à un bug d'affichage.
  const deficitMad = committedOutflowMad - startBalanceMad;
  const inDeficit = deficitMad > 0;

  const spentPct = safeDailySpendMad > 0 ? Math.min(100, (todaySpentMad / safeDailySpendMad) * 100) : todaySpentMad > 0 ? 100 : 0;
  const overToday = todaySpentMad > safeDailySpendMad;

  return (
    <div className="p-6 border bg-surface rounded-2xl border-line">
      <div className="flex items-center gap-2 mb-4">
        <Gauge className="w-4 h-4 text-blue-400" />
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-subtle flex-1">
          {t('calendar.outlook.title')}
        </h3>
        {!loading && complete && !failed && <CoachRegenerateButton onClick={regenerate} loading={regenerating} />}
      </div>

      <div className={`p-3 rounded-xl border mb-2 ${risky ? 'bg-red-500/10 border-red-500/20' : 'bg-blue-500/10 border-blue-500/20'}`}>
        <p className={`text-2xl font-black tabular-nums ${risky ? 'text-red-400' : 'text-blue-400'}`}>
          {formatMAD(Math.max(0, safeDailySpendMad))}
        </p>
        <p className="text-[10px] uppercase font-bold tracking-widest text-subtle">
          {tParams(t('calendar.outlook.perDayUntil'), { days: daysRemaining })}
        </p>
      </div>

      {/* Réalisé du jour vs budget — voir lib/billCalendar.ts
          (getTodayDiscretionarySpendMad) pour l'exclusion des dépenses déjà
          comptées comme échéances. */}
      <div className="mb-4 px-1">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-subtle">{t('calendar.outlook.spentToday')}</span>
          <span className={`font-bold tabular-nums ${overToday ? 'text-red-400' : 'text-body'}`}>
            {formatMAD(todaySpentMad)} / {formatMAD(safeDailySpendMad)}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-alt overflow-hidden">
          <div
            className={`h-full rounded-full ${overToday ? 'bg-red-500' : 'bg-emerald-500'}`}
            style={{ width: `${spentPct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-subtle mb-1 px-1">
        <span>{t('calendar.outlook.currentBalance')}</span>
        <span className="font-bold text-body tabular-nums">{formatMAD(startBalanceMad)}</span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-subtle mb-4 px-1">
        <span>{t('calendar.outlook.committedOutflow')}</span>
        <span className="font-bold text-body tabular-nums">− {formatMAD(committedOutflowMad)}</span>
      </div>

      {inDeficit && (
        <div className="p-3 rounded-xl border bg-red-500/10 border-red-500/20 text-red-400 mb-4 text-[11px] font-bold">
          {tParams(t('calendar.outlook.deficitWarning'), { deficit: Math.round(deficitMad) })}
        </div>
      )}

      {categoryBreakdown.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] uppercase font-bold tracking-widest text-faint mb-2 px-1">
            {t('calendar.outlook.categoryBreakdown')}
          </p>
          <div className="space-y-1 px-1">
            {categoryBreakdown.map((c) => (
              <div key={c.categoryId} className="flex items-center justify-between text-[11px]">
                <span className="text-subtle truncate">{c.categoryName}</span>
                <span className="font-bold text-body-soft tabular-nums shrink-0 ml-2">{formatMAD(c.shareMad)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-2.5 bg-surface-alt rounded w-full" />
          <div className="h-2.5 bg-surface-alt rounded w-5/6" />
          <div className="h-2.5 bg-surface-alt rounded w-4/6" />
        </div>
      ) : complete && !failed ? (
        <div className="space-y-3 text-[12px] leading-relaxed text-muted">
          <p>{advice?.synthese}</p>
          <p>
            <span className="font-bold text-body">{t('calendar.outlook.attention')}</span> {advice?.pointAttention}
          </p>
          <p>
            <span className="font-bold text-body">{t('calendar.outlook.recommandation')}</span> {advice?.recommandation}
          </p>
          {generatedAt && (
            <p className="flex items-center gap-1 text-[10px] text-faint italic pt-1">
              <Sparkles className="w-3 h-3" />
              {t('coach.generatedOn')}{' '}
              {new Date(generatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
      ) : (
        <p className="text-[12px] leading-relaxed text-muted">
          {tParams(t('calendar.outlook.staticFallback'), {
            outflow: Math.round(committedOutflowMad),
            days: daysRemaining,
          })}
        </p>
      )}
    </div>
  );
}
