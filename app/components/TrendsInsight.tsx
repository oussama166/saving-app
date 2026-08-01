'use client';

import { Compass, Sparkles } from 'lucide-react';
import type { MonthlyAnalytics, CategoryTrend } from '@/lib/financials';
import { useLanguage } from './LanguageProvider';
import { tParams } from '@/lib/i18n';
import { useCoachAdvice } from '../hooks/useCoachAdvice';
import { trendsInsightSchema } from '@/lib/coachSchemas';
import CoachRegenerateButton from './CoachRegenerateButton';

interface Props {
  monthly: MonthlyAnalytics[];
  topCategories: CategoryTrend[];
}

export default function TrendsInsight({ monthly, topCategories }: Props) {
  const { t } = useLanguage();
  const { advice: insight, loading, regenerating, failed, generatedAt, regenerate } = useCoachAdvice(
    '/api/coach/trends-insight',
    trendsInsightSchema,
    {
      monthly: monthly.map((m) => ({
        label: m.label,
        income: m.income,
        expenses: m.expenses,
        savings: m.savings,
        savingsRatePct: m.savingsRatePct,
      })),
      topCategories: topCategories.map((c) => ({ name: c.name, total: c.total, trendPct: c.trendPct })),
    },
  );

  const complete = Boolean(insight?.synthese && insight?.pointAttention && insight?.recommandation);

  return (
    <div className="bg-surface rounded-xl border border-line p-6">
      <div className="flex items-center gap-3 mb-6">
        <Compass className="w-6 h-6 text-blue-400" />
        <h3 className="text-lg font-bold text-body">{t('coach.trends.title')}</h3>
        <div className="ml-auto flex items-center gap-3">
          {loading && (
            <span className="flex items-center gap-1.5 text-[10px] text-blue-400 font-bold uppercase tracking-widest">
              <Sparkles className="w-3 h-3 animate-pulse" />
              {t('coach.analyzing')}
            </span>
          )}
          {!loading && complete && !failed && (
            <>
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
                <Sparkles className="w-3 h-3" />
                {t('coach.aiCoach')}
              </span>
              <CoachRegenerateButton onClick={regenerate} loading={regenerating} />
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-3 bg-surface-alt rounded w-full" />
          <div className="h-3 bg-surface-alt rounded w-5/6" />
          <div className="h-3 bg-surface-alt rounded w-4/6" />
        </div>
      ) : complete && !failed ? (
        <div className="space-y-4 text-[13px] leading-relaxed text-muted">
          <p>
            <span className="font-bold text-body">{t('coach.trends.tendance')}</span> {insight?.synthese}
          </p>
          <p>
            <span className="font-bold text-body">{t('coach.trends.pointAttention')}</span> {insight?.pointAttention}
          </p>
          <p>
            <span className="font-bold text-body">{t('coach.trends.recommandation')}</span> {insight?.recommandation}
          </p>
          {generatedAt && (
            <p className="text-[10px] text-faint italic pt-1">
              {t('coach.generatedOn')}{' '}
              {new Date(generatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
              , {t('coach.weeklyRefresh')}
            </p>
          )}
        </div>
      ) : (
        <StaticFallback monthly={monthly} topCategories={topCategories} t={t} />
      )}
    </div>
  );
}

// Repli si le Coach IA est indisponible (clé API manquante, quota dépassé,
// erreur réseau...) : mêmes libellés que l'analyse IA, mais calculés par des
// règles simples sur les données déjà chargées côté client, plutôt qu'un
// message générique sans rapport avec les vraies données de l'utilisateur.
function StaticFallback({ monthly, topCategories, t }: Props & { t: ReturnType<typeof useLanguage>['t'] }) {
  const withActivity = monthly.filter((m) => m.income > 0 || m.expenses > 0);
  const first = withActivity[0] ?? null;
  const last = withActivity[withActivity.length - 1] ?? null;

  const synthese =
    first && last && first.expenses > 0
      ? tParams(t('coach.trends.staticSyntheseTemplate'), {
          firstLabel: first.label,
          firstExpenses: Math.round(first.expenses),
          lastLabel: last.label,
          lastExpenses: Math.round(last.expenses),
          avgRate: Math.round(withActivity.reduce((acc, m) => acc + m.savingsRatePct, 0) / withActivity.length),
        })
      : t('coach.trends.noHistory');

  const worstCategory = [...topCategories].sort((a, b) => (b.trendPct ?? 0) - (a.trendPct ?? 0))[0] ?? null;
  const pointAttention =
    worstCategory && worstCategory.trendPct !== null && worstCategory.trendPct > 0
      ? tParams(t('coach.trends.pointAttentionTemplate'), {
          category: worstCategory.name,
          trendPct: worstCategory.trendPct,
          total: worstCategory.total,
        })
      : t('coach.trends.noStandoutCategory');

  const recommandation =
    last && last.savingsRatePct < 20
      ? tParams(t('coach.trends.recommandationBelowTarget'), { rate: last.savingsRatePct })
      : t('coach.trends.recommandationOnTarget');

  return (
    <div className="space-y-4 text-[13px] leading-relaxed text-muted">
      <p>
        <span className="font-bold text-body">{t('coach.trends.tendance')}</span> {synthese}
      </p>
      <p>
        <span className="font-bold text-body">{t('coach.trends.pointAttention')}</span> {pointAttention}
      </p>
      <p>
        <span className="font-bold text-body">{t('coach.trends.recommandation')}</span> {recommandation}
      </p>
      <p className="text-[10px] text-faint italic pt-1">{t('coach.fallbackNotice')}</p>
    </div>
  );
}
