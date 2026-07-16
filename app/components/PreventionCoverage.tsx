'use client';

import { useEffect, useState } from 'react';
import { ShieldPlus, Sparkles } from 'lucide-react';
import { useLanguage } from './LanguageProvider';

interface Props {
  spentThisMonth: number;
  weightOnIncomePct: number;
  remaining: number;
  pendingReimbursementTotal: number;
  pendingCount: number;
  recordsCount: number;
}

interface Advice {
  bilanAnnuel: string;
  couvertureCnss: string;
  mutuelle: string;
  pharmacieGeneriques: string;
}

export default function PreventionCoverage({
  spentThisMonth,
  weightOnIncomePct,
  remaining,
  pendingReimbursementTotal,
  pendingCount,
  recordsCount,
}: Props) {
  const { t } = useLanguage();
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const BLOCK_META = [
    { key: 'bilanAnnuel' as const, emoji: '🩺', title: t('coach.prevention.bilan') },
    { key: 'couvertureCnss' as const, emoji: '🏥', title: t('coach.prevention.cnss') },
    { key: 'mutuelle' as const, emoji: '➕', title: t('coach.prevention.mutuelle') },
    { key: 'pharmacieGeneriques' as const, emoji: '💊', title: t('coach.prevention.pharmacie') },
  ];

  useEffect(() => {
    let cancelled = false;

    fetch('/api/coach/prevention-coverage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spentThisMonth,
        weightOnIncomePct,
        remaining,
        pendingReimbursementTotal,
        pendingCount,
        recordsCount,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Request failed');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data.success && data.advice) {
          setAdvice(data.advice);
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
  }, [spentThisMonth, weightOnIncomePct, remaining, pendingReimbursementTotal, pendingCount, recordsCount]);

  return (
    <div className="bg-surface rounded-2xl border border-line p-8">
      <div className="flex items-center gap-3 mb-6">
        <ShieldPlus className="w-6 h-6 text-rose-400" />
        <h2 className="text-xl font-bold text-ink tracking-tight">{t('coach.prevention.title')}</h2>
        {loading && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-blue-400 font-bold uppercase tracking-widest">
            <Sparkles className="w-3 h-3 animate-pulse" />
            {t('coach.analyzing')}
          </span>
        )}
        {!loading && advice && !failed && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
            <Sparkles className="w-3 h-3" />
            {t('coach.aiCoach')}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          {BLOCK_META.map((b) => (
            <div key={b.key} className="space-y-2">
              <div className="h-3 bg-surface-alt rounded w-1/2" />
              <div className="h-3 bg-surface-alt rounded w-full" />
              <div className="h-3 bg-surface-alt rounded w-5/6" />
            </div>
          ))}
        </div>
      ) : advice && !failed ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {BLOCK_META.map((b) => (
              <div key={b.key} className="space-y-2">
                <p className="text-sm font-bold text-body">
                  {b.emoji} {b.title}
                </p>
                <p className="text-[13px] text-muted leading-relaxed">{advice[b.key]}</p>
              </div>
            ))}
          </div>
          {generatedAt && (
            <p className="text-[10px] text-faint italic pt-6">
              {t('coach.generatedOn')}{' '}
              {new Date(generatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
              , {t('coach.weeklyRefresh')}
            </p>
          )}
        </>
      ) : (
        <StaticFallback t={t} />
      )}
    </div>
  );
}

// Contenu générique conservé comme repli si l'appel au Coach IA échoue
// (clé API manquante, quota dépassé, erreur réseau...).
function StaticFallback({ t }: { t: ReturnType<typeof useLanguage>['t'] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-2">
        <p className="text-sm font-bold text-body">🩺 {t('coach.prevention.bilan')}</p>
        <p className="text-[13px] text-muted leading-relaxed">{t('coach.prevention.staticBilan')}</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-bold text-body">🏥 {t('coach.prevention.cnss')}</p>
        <p className="text-[13px] text-muted leading-relaxed">{t('coach.prevention.staticCnss')}</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-bold text-body">➕ {t('coach.prevention.mutuelle')}</p>
        <p className="text-[13px] text-muted leading-relaxed">{t('coach.prevention.staticMutuelle')}</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-bold text-body">💊 {t('coach.prevention.pharmacie')}</p>
        <p className="text-[13px] text-muted leading-relaxed">{t('coach.prevention.staticPharmacie')}</p>
      </div>
    </div>
  );
}
