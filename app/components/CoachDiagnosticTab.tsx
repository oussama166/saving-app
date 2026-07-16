'use client';

import { useEffect, useState } from 'react';
import { Gauge, Sparkles, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { tParams } from '@/lib/i18n';

interface BudgetDetail {
  categoryName: string;
  allocationPct: number;
  budgetedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  usedPct: number;
}

interface Rule503020 {
  needs: { amount: number; pct: number };
  wants: { amount: number; pct: number };
  savings: { amount: number; pct: number };
}

interface Props {
  budgetDetails: BudgetDetail[];
  rule503020: Rule503020;
  emergencyFundMonths: number;
  healthScore: number;
}

interface Diagnostic {
  profilLabel: string;
  profilDesc: string;
  pointFort: string;
  pointFaible: string;
  recommandation: string;
}

const formatCUR = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

// Classification simple du profil dépensier à partir de la règle 50/30/20 —
// utilisée uniquement en repli si le Coach IA est indisponible.
function getSpenderProfile(rule: Rule503020, t: ReturnType<typeof useLanguage>['t']) {
  if (rule.savings.pct >= 20) {
    return {
      emoji: '🟢',
      label: t('coach.diagnostic.profileEpargnant'),
      desc: tParams(t('coach.diagnostic.profileEpargnantDesc'), { pct: rule.savings.pct }),
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    };
  }
  if (rule.wants.pct > 35) {
    return {
      emoji: '🟠',
      label: t('coach.diagnostic.profileLoisirs'),
      desc: tParams(t('coach.diagnostic.profileLoisirsDesc'), { pct: rule.wants.pct }),
      color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    };
  }
  if (rule.needs.pct > 60) {
    return {
      emoji: '🔴',
      label: t('coach.diagnostic.profileCharges'),
      desc: tParams(t('coach.diagnostic.profileChargesDesc'), { pct: rule.needs.pct }),
      color: 'text-red-400 bg-red-500/10 border-red-500/20',
    };
  }
  return {
    emoji: '🔵',
    label: t('coach.diagnostic.profileEquilibre'),
    desc: tParams(t('coach.diagnostic.profileEquilibreDesc'), {
      needs: rule.needs.pct,
      wants: rule.wants.pct,
      savings: rule.savings.pct,
    }),
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  };
}

export default function CoachDiagnosticTab({ budgetDetails, rule503020, emergencyFundMonths, healthScore }: Props) {
  const { t } = useLanguage();
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/coach/diagnostic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        budgetDetails,
        rule503020,
        emergencyFundMonths,
        healthScore,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Request failed');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data.success && data.advice) {
          setDiagnostic(data.advice);
          if (data.generatedAt) setGeneratedAt(data.generatedAt);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const staticProfile = getSpenderProfile(rule503020, t);
  const badge = (
    <>
      {loading && (
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-blue-400 font-bold uppercase tracking-widest">
          <Sparkles className="w-3 h-3 animate-pulse" />
          {t('coach.analyzing')}
        </span>
      )}
      {!loading && diagnostic && !failed && (
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
          <Sparkles className="w-3 h-3" />
          {t('coach.aiCoach')}
        </span>
      )}
    </>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="p-8 space-y-3 border bg-surface rounded-2xl border-line animate-pulse">
          <div className="w-1/3 h-3 rounded bg-surface-alt" />
          <div className="w-full h-3 rounded bg-surface-alt" />
          <div className="w-5/6 h-3 rounded bg-surface-alt" />
          <div className="w-4/6 h-3 rounded bg-surface-alt" />
        </div>
      </div>
    );
  }

  if (diagnostic && !failed) {
    return (
      <div className="space-y-6">
        <div className="p-8 border bg-surface rounded-2xl border-line">
          <div className="flex items-center gap-3 mb-4">
            <Gauge className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold tracking-tight text-ink">{t('coach.diagnostic.profil')}</h3>
            {badge}
          </div>
          <p className="mb-2 text-lg font-black text-ink">{diagnostic.profilLabel}</p>
          <p className="text-[13px] text-muted leading-relaxed">{diagnostic.profilDesc}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="p-5 border rounded-2xl bg-emerald-500/10 border-emerald-500/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                {t('coach.diagnostic.pointFort')}
              </span>
            </div>
            <p className="text-[13px] text-body-soft leading-relaxed">{diagnostic.pointFort}</p>
          </div>
          <div className="p-5 border rounded-2xl bg-red-500/10 border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">
                {t('coach.diagnostic.pointFaible')}
              </span>
            </div>
            <p className="text-[13px] text-body-soft leading-relaxed">{diagnostic.pointFaible}</p>
          </div>
        </div>

        <div className="p-8 border bg-surface rounded-2xl border-line">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold tracking-tight text-ink">{t('coach.diagnostic.recommandationMonth')}</h3>
            <span className="ml-auto text-[10px] text-subtle font-bold uppercase tracking-widest">
              {t('coach.diagnostic.scoreLabel')} {healthScore}%
            </span>
          </div>
          <p className="text-[13px] text-muted leading-relaxed">{diagnostic.recommandation}</p>

          {generatedAt && (
            <p className="text-[10px] text-faint italic pt-4 mt-4 border-t border-line-subtle">
              {t('coach.generatedOn')}{' '}
              {new Date(generatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
              , {t('coach.weeklyRefresh')}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Repli : diagnostic à règles simples si le Coach IA est indisponible
  // (clé API manquante, quota dépassé, erreur réseau...).
  const budgeted = budgetDetails.filter((b) => b.budgetedAmount > 0);
  const pointFaible = budgeted.filter((b) => b.usedPct > 80).sort((a, b) => b.usedPct - a.usedPct)[0] ?? null;
  const pointFort = budgeted.filter((b) => b.usedPct <= 50).sort((a, b) => a.usedPct - b.usedPct)[0] ?? null;

  const recommendation = pointFaible
    ? tParams(t('coach.diagnostic.recoPriority'), {
        category: pointFaible.categoryName,
        pct: pointFaible.usedPct,
        spent: formatCUR(pointFaible.spentAmount),
        budget: formatCUR(pointFaible.budgetedAmount),
      })
    : emergencyFundMonths < 3
      ? tParams(t('coach.diagnostic.recoEmergencyLow'), { months: emergencyFundMonths.toFixed(1) })
      : tParams(t('coach.diagnostic.recoStrong'), { months: emergencyFundMonths.toFixed(1) });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className={`p-6 rounded-2xl border ${staticProfile.color} lg:col-span-1`}>
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">{t('coach.diagnostic.profil')}</span>
          </div>
          <p className="mb-2 text-lg font-black">
            {staticProfile.emoji} {staticProfile.label}
          </p>
          <p className="text-[12px] leading-relaxed opacity-90">{staticProfile.desc}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 border rounded-2xl border-line bg-surface lg:col-span-2 sm:grid-cols-2">
          <div className="p-4 border rounded-xl bg-emerald-500/10 border-emerald-500/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                {t('coach.diagnostic.pointFort')}
              </span>
            </div>
            {pointFort ? (
              <p className="text-[13px] text-body-soft leading-relaxed">
                {tParams(t('coach.diagnostic.pointFortTemplate'), {
                  category: pointFort.categoryName,
                  pct: pointFort.usedPct,
                  spent: formatCUR(pointFort.spentAmount),
                  budget: formatCUR(pointFort.budgetedAmount),
                })}
              </p>
            ) : (
              <p className="text-[13px] text-subtle italic">{t('coach.diagnostic.noPointFort')}</p>
            )}
          </div>

          <div className="p-4 border rounded-xl bg-red-500/10 border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">
                {t('coach.diagnostic.pointFaible')}
              </span>
            </div>
            {pointFaible ? (
              <p className="text-[13px] text-body-soft leading-relaxed">
                {tParams(t('coach.diagnostic.pointFaibleTemplate'), {
                  category: pointFaible.categoryName,
                  pct: pointFaible.usedPct,
                  spent: formatCUR(pointFaible.spentAmount),
                  budget: formatCUR(pointFaible.budgetedAmount),
                })}
              </p>
            ) : (
              <p className="text-[13px] text-subtle italic">{t('coach.diagnostic.noPointFaible')}</p>
            )}
          </div>
        </div>
      </div>

      <div className="p-8 border bg-surface rounded-2xl border-line">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-bold tracking-tight text-ink">{t('coach.diagnostic.recommandationMonth')}</h3>
          <span className="ml-auto text-[10px] text-subtle font-bold uppercase tracking-widest">
            {t('coach.diagnostic.scoreLabel')} {healthScore}%
          </span>
        </div>
        <p className="text-[13px] text-muted leading-relaxed">{recommendation}</p>

        <div className="flex items-start gap-2 pt-4 mt-6 border-t border-line-subtle">
          <Info className="w-3.5 h-3.5 text-faint mt-0.5 shrink-0" />
          <p className="text-[10px] text-faint italic leading-relaxed">{t('coach.diagnostic.aiFallbackNotice')}</p>
        </div>
      </div>
    </div>
  );
}
