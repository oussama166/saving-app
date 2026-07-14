'use client';

import { useEffect, useState } from 'react';
import { Compass, Sparkles } from 'lucide-react';
import type { MonthlyAnalytics, CategoryTrend } from '@/lib/financials';

interface Props {
  monthly: MonthlyAnalytics[];
  topCategories: CategoryTrend[];
}

interface Insight {
  synthese: string;
  pointAttention: string;
  recommandation: string;
}

export default function TrendsInsight({ monthly, topCategories }: Props) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/coach/trends-insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        monthly: monthly.map((m) => ({
          label: m.label,
          income: m.income,
          expenses: m.expenses,
          savings: m.savings,
          savingsRatePct: m.savingsRatePct,
        })),
        topCategories: topCategories.map((c) => ({ name: c.name, total: c.total, trendPct: c.trendPct })),
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Request failed');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data.success && data.advice) {
          setInsight(data.advice);
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

  return (
    <div className="bg-[#1b253b] rounded-xl border border-slate-700 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Compass className="w-6 h-6 text-blue-400" />
        <h3 className="text-lg font-bold text-slate-200">Analyse IA des Tendances</h3>
        {loading && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-blue-400 font-bold uppercase tracking-widest">
            <Sparkles className="w-3 h-3 animate-pulse" />
            Analyse IA...
          </span>
        )}
        {!loading && insight && !failed && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
            <Sparkles className="w-3 h-3" />
            Coach IA
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-3 bg-slate-800 rounded w-full" />
          <div className="h-3 bg-slate-800 rounded w-5/6" />
          <div className="h-3 bg-slate-800 rounded w-4/6" />
        </div>
      ) : insight && !failed ? (
        <div className="space-y-4 text-[13px] leading-relaxed text-slate-400">
          <p>
            <span className="font-bold text-slate-200">Tendance :</span> {insight.synthese}
          </p>
          <p>
            <span className="font-bold text-slate-200">Point d&apos;Attention :</span> {insight.pointAttention}
          </p>
          <p>
            <span className="font-bold text-slate-200">Recommandation :</span> {insight.recommandation}
          </p>
          {generatedAt && (
            <p className="text-[10px] text-slate-600 italic pt-1">
              Analyse générée le{' '}
              {new Date(generatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
              , actualisée une fois par semaine.
            </p>
          )}
        </div>
      ) : (
        <StaticFallback monthly={monthly} topCategories={topCategories} />
      )}
    </div>
  );
}

// Repli si le Coach IA est indisponible (clé API manquante, quota dépassé,
// erreur réseau...) : mêmes libellés que l'analyse IA, mais calculés par des
// règles simples sur les données déjà chargées côté client, plutôt qu'un
// message générique sans rapport avec les vraies données de l'utilisateur.
function StaticFallback({ monthly, topCategories }: Props) {
  const withActivity = monthly.filter((m) => m.income > 0 || m.expenses > 0);
  const first = withActivity[0] ?? null;
  const last = withActivity[withActivity.length - 1] ?? null;

  const synthese =
    first && last && first.expenses > 0
      ? `Vos dépenses sont passées de ${first.label} (${Math.round(first.expenses)} DH) à ${last.label} (${Math.round(
          last.expenses,
        )} DH), avec un taux d'épargne moyen de ${Math.round(
          withActivity.reduce((acc, m) => acc + m.savingsRatePct, 0) / withActivity.length,
        )}% sur la période.`
      : "Pas encore assez d'historique pour dégager une tendance fiable — continuez à enregistrer vos transactions.";

  const worstCategory = [...topCategories].sort((a, b) => (b.trendPct ?? 0) - (a.trendPct ?? 0))[0] ?? null;
  const pointAttention =
    worstCategory && worstCategory.trendPct !== null && worstCategory.trendPct > 0
      ? `"${worstCategory.name}" est la catégorie qui a le plus progressé sur la période (+${worstCategory.trendPct}%, ${worstCategory.total} DH cumulés).`
      : "Aucune catégorie ne se démarque nettement à la hausse sur la période observée.";

  const recommandation =
    last && last.savingsRatePct < 20
      ? `Votre taux d'épargne du dernier mois (${last.savingsRatePct}%) est sous la cible de 20% — revoyez en priorité la catégorie qui a le plus progressé ce mois-ci.`
      : "Votre taux d'épargne récent est dans la cible : maintenez ce rythme et surveillez les catégories qui progressent le plus vite.";

  return (
    <div className="space-y-4 text-[13px] leading-relaxed text-slate-400">
      <p>
        <span className="font-bold text-slate-200">Tendance :</span> {synthese}
      </p>
      <p>
        <span className="font-bold text-slate-200">Point d&apos;Attention :</span> {pointAttention}
      </p>
      <p>
        <span className="font-bold text-slate-200">Recommandation :</span> {recommandation}
      </p>
      <p className="text-[10px] text-slate-600 italic pt-1">
        Coach IA indisponible pour le moment — analyse de repli basée sur des règles simples.
      </p>
    </div>
  );
}
