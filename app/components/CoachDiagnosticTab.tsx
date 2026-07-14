'use client';

import { useEffect, useState } from 'react';
import { Gauge, Sparkles, TrendingUp, TrendingDown, Info } from 'lucide-react';

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
function getSpenderProfile(rule: Rule503020) {
  if (rule.savings.pct >= 20) {
    return {
      emoji: '🟢',
      label: 'Épargnant Discipliné',
      desc: `Vous épargnez/investissez ${rule.savings.pct}% de vos revenus ce mois-ci, au niveau ou au-dessus de la règle des 20%.`,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    };
  }
  if (rule.wants.pct > 35) {
    return {
      emoji: '🟠',
      label: 'Dépensier Loisirs',
      desc: `Vos dépenses "Envies" représentent ${rule.wants.pct}% de vos revenus, bien au-dessus des 30% recommandés.`,
      color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    };
  }
  if (rule.needs.pct > 60) {
    return {
      emoji: '🔴',
      label: 'Charges Serrées',
      desc: `Vos charges essentielles ("Besoins") pèsent ${rule.needs.pct}% de vos revenus, au-dessus des 50% recommandés — peu de marge de manœuvre.`,
      color: 'text-red-400 bg-red-500/10 border-red-500/20',
    };
  }
  return {
    emoji: '🔵',
    label: 'Équilibré',
    desc: `Votre répartition Besoins/Envies/Épargne (${rule.needs.pct}% / ${rule.wants.pct}% / ${rule.savings.pct}%) reste proche de la règle 50/30/20.`,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  };
}

export default function CoachDiagnosticTab({ budgetDetails, rule503020, emergencyFundMonths, healthScore }: Props) {
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

  const staticProfile = getSpenderProfile(rule503020);
  const badge = (
    <>
      {loading && (
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-blue-400 font-bold uppercase tracking-widest">
          <Sparkles className="w-3 h-3 animate-pulse" />
          Analyse IA...
        </span>
      )}
      {!loading && diagnostic && !failed && (
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
          <Sparkles className="w-3 h-3" />
          Coach IA
        </span>
      )}
    </>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-[#1b253b] rounded-2xl border border-slate-700 p-8 animate-pulse space-y-3">
          <div className="h-3 bg-slate-800 rounded w-1/3" />
          <div className="h-3 bg-slate-800 rounded w-full" />
          <div className="h-3 bg-slate-800 rounded w-5/6" />
          <div className="h-3 bg-slate-800 rounded w-4/6" />
        </div>
      </div>
    );
  }

  if (diagnostic && !failed) {
    return (
      <div className="space-y-6">
        <div className="bg-[#1b253b] rounded-2xl border border-slate-700 p-8">
          <div className="flex items-center gap-3 mb-4">
            <Gauge className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold text-white tracking-tight">Profil Dépensier</h3>
            {badge}
          </div>
          <p className="text-lg font-black text-white mb-2">{diagnostic.profilLabel}</p>
          <p className="text-[13px] text-slate-400 leading-relaxed">{diagnostic.profilDesc}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Point Fort</span>
            </div>
            <p className="text-[13px] text-slate-300 leading-relaxed">{diagnostic.pointFort}</p>
          </div>
          <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">Point Faible</span>
            </div>
            <p className="text-[13px] text-slate-300 leading-relaxed">{diagnostic.pointFaible}</p>
          </div>
        </div>

        <div className="bg-[#1b253b] rounded-2xl border border-slate-700 p-8">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold text-white tracking-tight">Recommandation du Mois</h3>
            <span className="ml-auto text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              Score Santé : {healthScore}%
            </span>
          </div>
          <p className="text-[13px] text-slate-400 leading-relaxed">{diagnostic.recommandation}</p>

          {generatedAt && (
            <p className="text-[10px] text-slate-600 italic pt-4 mt-4 border-t border-slate-800">
              Analyse générée le{' '}
              {new Date(generatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
              , actualisée une fois par semaine.
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
    ? `Priorité : "${pointFaible.categoryName}" a déjà consommé ${pointFaible.usedPct}% de son budget (${formatCUR(
        pointFaible.spentAmount,
      )} / ${formatCUR(pointFaible.budgetedAmount)}). Ralentissez sur cette catégorie jusqu'à la fin du mois.`
    : emergencyFundMonths < 3
      ? `Aucune catégorie en dépassement ce mois-ci. Concentrez l'effort sur le fonds d'urgence : il ne couvre que ${emergencyFundMonths.toFixed(1)} mois de dépenses (cible : 3 mois minimum).`
      : `Aucune catégorie en dépassement et fonds d'urgence solide (${emergencyFundMonths.toFixed(1)} mois). Continuez sur cette lancée et envisagez d'augmenter vos versements d'investissement.`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`p-6 rounded-2xl border ${staticProfile.color} lg:col-span-1`}>
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Profil Dépensier</span>
          </div>
          <p className="text-lg font-black mb-2">
            {staticProfile.emoji} {staticProfile.label}
          </p>
          <p className="text-[12px] leading-relaxed opacity-90">{staticProfile.desc}</p>
        </div>

        <div className="p-6 rounded-2xl border border-slate-700 bg-[#1b253b] lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Point Fort</span>
            </div>
            {pointFort ? (
              <p className="text-[13px] text-slate-300 leading-relaxed">
                <span className="font-bold text-slate-100">{pointFort.categoryName}</span> : seulement{' '}
                {pointFort.usedPct}% du budget utilisé ({formatCUR(pointFort.spentAmount)} /{' '}
                {formatCUR(pointFort.budgetedAmount)}).
              </p>
            ) : (
              <p className="text-[13px] text-slate-500 italic">Pas de catégorie nettement sous-consommée ce mois-ci.</p>
            )}
          </div>

          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">Point Faible</span>
            </div>
            {pointFaible ? (
              <p className="text-[13px] text-slate-300 leading-relaxed">
                <span className="font-bold text-slate-100">{pointFaible.categoryName}</span> : déjà{' '}
                {pointFaible.usedPct}% du budget utilisé ({formatCUR(pointFaible.spentAmount)} /{' '}
                {formatCUR(pointFaible.budgetedAmount)}).
              </p>
            ) : (
              <p className="text-[13px] text-slate-500 italic">Aucune catégorie au-dessus de 80% du budget. 👍</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#1b253b] rounded-2xl border border-slate-700 p-8">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-bold text-white tracking-tight">Recommandation du Mois</h3>
          <span className="ml-auto text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            Score Santé : {healthScore}%
          </span>
        </div>
        <p className="text-[13px] text-slate-400 leading-relaxed">{recommendation}</p>

        <div className="mt-6 pt-4 border-t border-slate-800 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-slate-600 mt-0.5 shrink-0" />
          <p className="text-[10px] text-slate-600 italic leading-relaxed">
            Coach IA indisponible pour le moment — diagnostic de repli basé sur des règles simples (seuils sur vos
            catégories budgétaires).
          </p>
        </div>
      </div>
    </div>
  );
}
