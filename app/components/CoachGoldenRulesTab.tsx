'use client';

import { useEffect, useState } from 'react';
import {
  Home,
  Car,
  Smartphone,
  UtensilsCrossed,
  CreditCard,
  ShieldCheck,
  PiggyBank,
  PieChart,
  BookOpen,
  Award,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import { useLanguage } from './LanguageProvider';

interface Props {
  referenceIncome: number;
  avgMonthlyExpenses: number;
}

type RuleStatus = 'respected' | 'exceeded' | 'info';

interface RuleResult {
  id: string;
  status: RuleStatus;
  detail: string;
}

interface Evaluation {
  results: RuleResult[];
  scorePct: number;
  scoredCount: number;
  respectedCount: number;
  history: { date: string; scorePct: number }[];
  newlyExceededRuleIds: string[] | null;
}

const formatCUR = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

function StatusBadge({ status }: { status: RuleStatus | undefined }) {
  if (!status) return null;
  if (status === 'respected') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full">
        <CheckCircle2 className="w-3 h-3" /> Respectée
      </span>
    );
  }
  if (status === 'exceeded') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-full">
        <XCircle className="w-3 h-3" /> Dépassée
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-subtle bg-surface-alt border border-line px-2 py-1 rounded-full">
      <Info className="w-3 h-3" /> Info
    </span>
  );
}

export default function CoachGoldenRulesTab({ referenceIncome, avgMonthlyExpenses }: Props) {
  const { t } = useLanguage();
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/coach/golden-rules')
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setEvaluation(result.data);
      })
      .catch((err) => console.error('Golden rules fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  const statusById = new Map((evaluation?.results ?? []).map((r) => [r.id, r]));

  const rules = [
    {
      id: 'rent',
      icon: Home,
      title: 'Règle du Loyer',
      rule: 'Le loyer ne devrait pas dépasser 30% du revenu mensuel.',
      value: `≤ ${formatCUR(referenceIncome * 0.3)} / mois`,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    },
    {
      id: 'car',
      icon: Car,
      title: 'Règle de la Voiture',
      rule: "La mensualité d'un crédit auto ne devrait pas dépasser 10% du revenu, et le prix du véhicule 6 mois de revenu.",
      value: `Mensualité ≤ ${formatCUR(referenceIncome * 0.1)} · Prix ≤ ${formatCUR(referenceIncome * 6)}`,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    },
    {
      id: 'smartphone',
      icon: Smartphone,
      title: 'Règle du Smartphone',
      rule: "Le prix d'un smartphone neuf ne devrait pas dépasser 5% du revenu mensuel.",
      value: `≤ ${formatCUR(referenceIncome * 0.05)}`,
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    },
    {
      id: 'dining',
      icon: UtensilsCrossed,
      title: 'Règle Restaurant & Sorties',
      rule: 'Le budget restaurants/sorties ne devrait pas dépasser 10% du revenu mensuel.',
      value: `≤ ${formatCUR(referenceIncome * 0.1)} / mois`,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
    {
      id: 'debt',
      icon: CreditCard,
      title: 'Règle du Crédit Consommation',
      rule: "Le total des mensualités de crédit (hors logement) ne devrait jamais dépasser 33% du revenu — c'est le taux d'endettement maximum généralement accepté par les banques marocaines.",
      value: `≤ ${formatCUR(referenceIncome * 0.33)} / mois`,
      color: 'text-red-400 bg-red-500/10 border-red-500/20',
    },
    {
      id: 'emergencyFund',
      icon: ShieldCheck,
      title: "Règle 3-6-12 (Fonds d'Urgence / Liquidité)",
      rule: '3 mois de dépenses = minimum vital, 6 mois = confortable, 12 mois = sécurité maximale avant de privilégier l’investissement plutôt que le cash. C’est aussi ton ratio de liquidité : combien de mois tu peux tenir avec le cash disponible sur tes comptes courants.',
      value: `3 mois : ${formatCUR(avgMonthlyExpenses * 3)} · 6 mois : ${formatCUR(avgMonthlyExpenses * 6)} · 12 mois : ${formatCUR(avgMonthlyExpenses * 12)}`,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
    {
      id: 'retirement',
      icon: PiggyBank,
      title: "Règle de l'Épargne Retraite",
      rule: "Vise 10 à 15% de ton revenu épargné chaque mois pour préparer ta retraite — la CNSS seule couvre rarement un niveau de vie équivalent, et peu d'employeurs au Maroc proposent une retraite complémentaire.",
      value: `${formatCUR(referenceIncome * 0.1)} – ${formatCUR(referenceIncome * 0.15)} / mois`,
      color: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    },
    {
      id: 'diversification',
      icon: PieChart,
      title: 'Règle de Diversification',
      rule: "Aucune classe d'actifs (actions, crypto, OPCVM, or...) ne devrait dépasser 50% de la valeur totale de ton portefeuille, pour limiter le risque de concentration.",
      value: 'Max 50% sur une seule classe d’actifs',
      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    },
  ];

  const scoreColor =
    evaluation && evaluation.scorePct >= 70
      ? 'text-emerald-400'
      : evaluation && evaluation.scorePct >= 40
        ? 'text-orange-400'
        : 'text-red-400';

  const ruleTitleById = new Map(rules.map((r) => [r.id, r.title]));

  return (
    <div className="space-y-6">
      {/* Ces règles sont des seuils fixes calculés côté client — aucun appel
          IA n'entre en jeu ici (contrairement à l'onglet Diagnostic), d'où ce
          badge distinct du badge "Coach IA" pour ne pas induire l'utilisateur
          en erreur sur ce qui est réellement généré par IA dans cette page. */}
      <div
        className="flex items-center gap-1.5 text-[10px] text-subtle font-bold uppercase tracking-widest w-fit"
        title={t('coach.staticContentNotice')}
      >
        <BookOpen className="w-3 h-3" />
        {t('coach.staticContent')}
      </div>

      {evaluation?.newlyExceededRuleIds && evaluation.newlyExceededRuleIds.length > 0 && (
        <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/10 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-[13px] text-red-400">
            Règle{evaluation.newlyExceededRuleIds.length > 1 ? 's' : ''} nouvellement dépassée
            {evaluation.newlyExceededRuleIds.length > 1 ? 's' : ''} :{' '}
            <span className="font-bold">
              {evaluation.newlyExceededRuleIds.map((id) => ruleTitleById.get(id) ?? id).join(', ')}
            </span>
          </p>
        </div>
      )}

      <div className="p-6 border bg-surface rounded-2xl border-line">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-4 h-4 text-blue-400" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-subtle">Score de conformité</h3>
        </div>

        {loading ? (
          <div className="h-8 w-24 bg-surface-alt rounded animate-pulse" />
        ) : evaluation ? (
          <>
            <p className={`text-2xl font-black tabular-nums ${scoreColor}`}>{evaluation.scorePct}%</p>
            <p className="text-[10px] uppercase font-bold tracking-widest text-subtle mb-4">
              {evaluation.respectedCount}/{evaluation.scoredCount} règles respectées
            </p>

            {evaluation.history.length > 1 && (
              <div className="flex items-center gap-1">
                {evaluation.history.map((h) => (
                  <span
                    key={h.date}
                    title={`${new Date(h.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} : ${h.scorePct}%`}
                    className={`flex-1 h-6 rounded ${
                      h.scorePct >= 70 ? 'bg-emerald-500/60' : h.scorePct >= 40 ? 'bg-orange-500/60' : 'bg-red-500/60'
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-[11px] text-subtle italic">Impossible de charger le score pour le moment.</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {rules.map((r) => {
          const result = statusById.get(r.id);
          return (
            <div key={r.id} className={`p-5 rounded-2xl border ${r.color} space-y-3`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <r.icon className="w-5 h-5" />
                  <h3 className="text-sm font-bold uppercase tracking-widest">{r.title}</h3>
                </div>
                <StatusBadge status={result?.status} />
              </div>
              <p className="text-[13px] text-body-soft leading-relaxed">{r.rule}</p>
              <p className="text-sm font-black text-ink pt-1 border-t border-white/10">{r.value}</p>
              {result && <p className="text-[11px] text-body-soft/80 italic">{result.detail}</p>}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-faint italic px-1">
        Seuils calculés à partir de votre revenu de référence ({formatCUR(referenceIncome)}/mois, page Profil) et de
        votre moyenne de dépenses glissante ({formatCUR(avgMonthlyExpenses)}/mois). Le statut Respectée/Dépassée est
        recalculé à chaque visite à partir de vos données réelles ; les règles &laquo;&nbsp;Info&nbsp;&raquo; (achats
        ponctuels) restent indicatives et hors score.
      </p>
    </div>
  );
}
