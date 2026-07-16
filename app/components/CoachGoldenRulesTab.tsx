'use client';

import { Home, Car, Smartphone, UtensilsCrossed, CreditCard, ShieldCheck } from 'lucide-react';

interface Props {
  referenceIncome: number;
  avgMonthlyExpenses: number;
}

const formatCUR = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

export default function CoachGoldenRulesTab({ referenceIncome, avgMonthlyExpenses }: Props) {
  const rules = [
    {
      icon: Home,
      title: 'Règle du Loyer',
      rule: 'Le loyer ne devrait pas dépasser 30% du revenu mensuel.',
      value: `≤ ${formatCUR(referenceIncome * 0.3)} / mois`,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    },
    {
      icon: Car,
      title: 'Règle de la Voiture',
      rule: "La mensualité d'un crédit auto ne devrait pas dépasser 10% du revenu, et le prix du véhicule 6 mois de revenu.",
      value: `Mensualité ≤ ${formatCUR(referenceIncome * 0.1)} · Prix ≤ ${formatCUR(referenceIncome * 6)}`,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    },
    {
      icon: Smartphone,
      title: 'Règle du Smartphone',
      rule: "Le prix d'un smartphone neuf ne devrait pas dépasser 5% du revenu mensuel.",
      value: `≤ ${formatCUR(referenceIncome * 0.05)}`,
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    },
    {
      icon: UtensilsCrossed,
      title: 'Règle Restaurant & Sorties',
      rule: 'Le budget restaurants/sorties ne devrait pas dépasser 10% du revenu mensuel.',
      value: `≤ ${formatCUR(referenceIncome * 0.1)} / mois`,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
    {
      icon: CreditCard,
      title: 'Règle du Crédit Consommation',
      rule: "Le total des mensualités de crédit (hors logement) ne devrait jamais dépasser 33% du revenu — c'est le taux d'endettement maximum généralement accepté par les banques marocaines.",
      value: `≤ ${formatCUR(referenceIncome * 0.33)} / mois`,
      color: 'text-red-400 bg-red-500/10 border-red-500/20',
    },
    {
      icon: ShieldCheck,
      title: 'Règle 3-6-12 (Fonds d’Urgence)',
      rule: '3 mois de dépenses = minimum vital, 6 mois = confortable, 12 mois = sécurité maximale avant de privilégier l’investissement plutôt que le cash.',
      value: `3 mois : ${formatCUR(avgMonthlyExpenses * 3)} · 6 mois : ${formatCUR(avgMonthlyExpenses * 6)} · 12 mois : ${formatCUR(avgMonthlyExpenses * 12)}`,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {rules.map((r) => (
          <div key={r.title} className={`p-5 rounded-2xl border ${r.color} space-y-3`}>
            <div className="flex items-center gap-2">
              <r.icon className="w-5 h-5" />
              <h3 className="text-sm font-bold uppercase tracking-widest">{r.title}</h3>
            </div>
            <p className="text-[13px] text-body-soft leading-relaxed">{r.rule}</p>
            <p className="text-sm font-black text-ink pt-1 border-t border-white/10">{r.value}</p>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-faint italic px-1">
        Seuils calculés à partir de votre revenu de référence ({formatCUR(referenceIncome)}/mois, page Profil) et de
        votre moyenne de dépenses glissante ({formatCUR(avgMonthlyExpenses)}/mois). Ce sont des repères généraux, pas
        des conseils personnalisés.
      </p>
    </div>
  );
}
