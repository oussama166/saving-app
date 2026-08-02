'use client';

import { Landmark, LineChart, Building2, Info, BookOpen, Users, Wallet, Percent, MapPin } from 'lucide-react';
import { useLanguage } from './LanguageProvider';

const formatCUR = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

const BANKS = [
  { name: 'CIH Bank (Code30)', fees: 'Compte gratuit', highlight: 'Épargne & crédit immobilier compétitifs' },
  { name: 'Attijariwafa (L’bankalik)', fees: 'Compte gratuit -26 ans', highlight: 'Réseau le plus étendu au Maroc' },
  { name: 'Bank Of Africa', fees: 'Frais variables', highlight: 'Bonne offre PME/professionnels' },
  { name: 'BMCE Direct', fees: 'Banque 100% digitale', highlight: 'Ouverture de compte rapide en ligne' },
];

const BROKERS = [
  { name: 'WafaBourse (Attijari)', desc: 'Plateforme de courtage la plus utilisée pour la Bourse de Casablanca (MASI).' },
  { name: 'CDG Capital Bourse', desc: 'Bon accès aux OPCVM et obligations, backing institutionnel solide.' },
  { name: 'BMCE Capital Bourse', desc: 'Interface simple, adaptée aux débutants en bourse marocaine.' },
];

const REAL_ESTATE = [
  { city: 'Tanger (centre / bord de mer)', range: '12 000 – 22 000 DH/m²' },
  { city: 'Tanger (périphérie)', range: '6 000 – 10 000 DH/m²' },
  { city: 'Casablanca (centre)', range: '15 000 – 30 000 DH/m²' },
  { city: 'Rabat (centre)', range: '13 000 – 25 000 DH/m²' },
];

// Salaires moyens mensuels bruts, estimations 2025-2026 (HCP/CNSS, ordres de
// grandeur — les enquêtes officielles portent sur des moyennes/médianes
// nationales, les chiffres par ville sont des estimations agrégées de
// plusieurs sources et varient selon la méthodologie).
const SALARY_BENCHMARKS = [
  { label: 'Médiane nationale', value: 3500 },
  { label: 'Moyenne nationale', value: 5500 },
  { label: 'Casablanca (moyenne)', value: 5500 },
  { label: 'Rabat (moyenne)', value: 5100 },
  { label: 'Tanger (moyenne)', value: 4500 },
  { label: 'Zones rurales (moyenne)', value: 3000 },
];

const HOUSEHOLD_INCOME_ANNUAL = 89170; // DH/an, revenu moyen des ménages (HCP)

const SAVINGS_BENCHMARKS = [
  { label: 'Épargne nationale (% du PIB)', value: '31,1%' },
  { label: 'Épargne des ménages (estimation)', value: '~14% du revenu' },
];

const COST_OF_LIVING = [
  {
    city: 'Tanger',
    single: '4 500 – 5 500 DH/mois (hors loyer)',
    rentStudio: '~4 670 DH (studio centre-ville)',
    rent3ch: '~8 386 DH (3 chambres)',
    note: 'Ville la plus chère du Maroc en 2026 (indice coût de la vie), portée par le boom de Tanger Med.',
  },
  {
    city: 'Casablanca',
    single: 'Comparable à Tanger, légèrement en dessous',
    rentStudio: '5 000 – 8 000 DH (studio/1 chambre)',
    rent3ch: '6 000 – 12 000 DH (2 chambres)',
    note: '2ᵉ ville la plus chère (indice), loyers parmi les plus élevés du pays.',
  },
  {
    city: 'Rabat',
    single: 'Comparable à Casablanca',
    rentStudio: 'Studios généralement moins chers qu’à Casablanca',
    rent3ch: 'Loyers 2-3 chambres souvent au-dessus de Casablanca',
    note: '3ᵉ ville la plus chère (indice) — capitale administrative, forte demande locative.',
  },
];

const INTEREST_BENCHMARKS = [
  { label: 'Bons du Trésor (52 semaines)', value: '~2,2%', note: 'Marché primaire, juillet 2026' },
  { label: 'Bons du Trésor (toutes durées)', value: '2,8% – 4,2%', note: 'Selon la durée, 2026' },
  { label: 'Compte sur carnet (épargne réglementée)', value: '1,82%', note: 'S2 2026, Bank Al-Maghrib' },
  { label: 'Livret bancaire classique', value: '~1,13%', note: 'Net annualisé, varie selon banque' },
  { label: 'Rendement locatif moyen national', value: '~4,8% brut', note: 'Jusqu’à 7-8% à Marrakech/Tanger' },
];

interface Props {
  referenceIncome?: number;
  avgMonthlyExpenses?: number;
  monthlySavings?: number;
}

export default function CoachBenchmarksTab({ referenceIncome = 0, avgMonthlyExpenses = 0, monthlySavings = 0 }: Props) {
  const { t } = useLanguage();
  const savingsRatePct = referenceIncome > 0 ? Math.round((monthlySavings / referenceIncome) * 100) : null;
  return (
    <div className="space-y-6">
      {/* Chiffres fixes maintenus à la main (pas d'appel IA) — badge distinct
          du badge "Coach IA" affiché par les autres onglets pour ne pas
          laisser croire que ces valeurs sont générées/personnalisées. */}
      <div
        className="flex items-center gap-1.5 text-[10px] text-subtle font-bold uppercase tracking-widest w-fit"
        title={t('coach.staticContentNotice')}
      >
        <BookOpen className="w-3 h-3" />
        {t('coach.staticContent')}
      </div>

      <div className="bg-surface rounded-2xl border border-line p-8">
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-bold text-ink tracking-tight">Ton positionnement</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-blue-600/10 border border-blue-500/20">
            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-1">Ton revenu de référence</p>
            <p className="text-xl font-black text-blue-400">{formatCUR(referenceIncome)}/mois</p>
            <p className="text-[11px] text-muted mt-1">
              {referenceIncome >= 5500
                ? 'Au-dessus de la moyenne nationale (~5 500 DH).'
                : referenceIncome >= 3500
                  ? 'Entre la médiane (~3 500 DH) et la moyenne nationale (~5 500 DH).'
                  : 'Sous la médiane nationale estimée (~3 500 DH).'}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-surface-deep/50 border border-line/50">
            <p className="text-[10px] text-subtle font-bold uppercase tracking-widest mb-1">Tes dépenses moyennes</p>
            <p className="text-xl font-black text-ink">{formatCUR(avgMonthlyExpenses)}/mois</p>
            <p className="text-[11px] text-muted mt-1">Moyenne glissante sur 3 mois.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="text-subtle uppercase tracking-wider text-[10px]">
                <th className="pb-3 font-bold">Repère (salaire moyen)</th>
                <th className="pb-3 font-bold text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle/50">
              {SALARY_BENCHMARKS.map((s) => (
                <tr key={s.label}>
                  <td className="py-2.5 text-muted">{s.label}</td>
                  <td className="py-2.5 text-right font-bold text-body">{formatCUR(s.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-faint mt-4">
          Revenu annuel moyen des ménages (HCP) : {formatCUR(HOUSEHOLD_INCOME_ANNUAL)}/an, soit ~
          {formatCUR(Math.round(HOUSEHOLD_INCOME_ANNUAL / 12))}/mois — ce chiffre porte sur le ménage entier, pas un
          salaire individuel.
        </p>
      </div>

      <div className="bg-surface rounded-2xl border border-line p-8">
        <div className="flex items-center gap-3 mb-6">
          <Percent className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-bold text-ink tracking-tight">Taux d&apos;épargne</h3>
        </div>
        {savingsRatePct !== null && (
          <div className="p-4 rounded-xl bg-emerald-600/10 border border-emerald-500/20 mb-4">
            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-1">Ton taux d&apos;épargne ce mois-ci</p>
            <p className="text-xl font-black text-emerald-400">{savingsRatePct}% du revenu de référence</p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SAVINGS_BENCHMARKS.map((s) => (
            <div key={s.label} className="p-4 rounded-xl bg-surface-deep/50 border border-line/50">
              <p className="text-[11px] text-muted mb-1">{s.label}</p>
              <p className="text-lg font-black text-ink">{s.value}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-faint mt-4">
          Source : Haut-Commissariat au Plan (HCP), épargne nationale à 31,1% du PIB au T3 2025 ; taux d&apos;épargne
          des ménages estimé, non publié en continu par le HCP.
        </p>
      </div>

      <div className="bg-surface rounded-2xl border border-line p-8">
        <div className="flex items-center gap-3 mb-6">
          <MapPin className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-bold text-ink tracking-tight">Coût de la vie par ville</h3>
        </div>
        <div className="space-y-4">
          {COST_OF_LIVING.map((c) => (
            <div key={c.city} className="p-4 rounded-xl bg-surface-deep/50 border border-line/50">
              <p className="text-sm font-bold text-body mb-2">{c.city}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[12px] text-muted mb-2">
                <p>
                  <span className="text-faint">Charges (hors loyer) : </span>
                  {c.single}
                </p>
                <p>
                  <span className="text-faint">Studio : </span>
                  {c.rentStudio}
                </p>
                <p>
                  <span className="text-faint">3 chambres : </span>
                  {c.rent3ch}
                </p>
              </div>
              <p className="text-[11px] text-faint italic">{c.note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-line p-8">
        <div className="flex items-center gap-3 mb-6">
          <Wallet className="w-5 h-5 text-teal-400" />
          <h3 className="text-lg font-bold text-ink tracking-tight">Taux d&apos;intérêt &amp; rendements actuels</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="text-subtle uppercase tracking-wider text-[10px]">
                <th className="pb-3 font-bold">Placement</th>
                <th className="pb-3 font-bold text-right">Taux</th>
                <th className="pb-3 font-bold text-right">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle/50">
              {INTEREST_BENCHMARKS.map((i) => (
                <tr key={i.label}>
                  <td className="py-2.5 text-muted">{i.label}</td>
                  <td className="py-2.5 text-right font-black text-teal-400">{i.value}</td>
                  <td className="py-2.5 text-right text-faint text-[11px]">{i.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-line p-8">
        <div className="flex items-center gap-3 mb-6">
          <Landmark className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-bold text-ink tracking-tight">Banques</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="text-subtle uppercase tracking-wider text-[10px]">
                <th className="pb-3 font-bold">Banque</th>
                <th className="pb-3 font-bold">Frais</th>
                <th className="pb-3 font-bold">Points forts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle/50">
              {BANKS.map((b) => (
                <tr key={b.name}>
                  <td className="py-3 font-bold text-body">{b.name}</td>
                  <td className="py-3 text-muted">{b.fees}</td>
                  <td className="py-3 text-muted">{b.highlight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-line p-8">
        <div className="flex items-center gap-3 mb-6">
          <LineChart className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-bold text-ink tracking-tight">Courtiers (Bourse de Casablanca)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {BROKERS.map((b) => (
            <div key={b.name} className="p-4 rounded-xl bg-surface-deep/50 border border-line/50">
              <p className="text-sm font-bold text-body mb-1.5">{b.name}</p>
              <p className="text-[12px] text-muted leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-line p-8">
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-bold text-ink tracking-tight">Prix Immobilier (ordres de grandeur)</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {REAL_ESTATE.map((r) => (
            <div key={r.city} className="p-4 rounded-xl bg-surface-deep/50 border border-line/50 flex justify-between items-center">
              <span className="text-[13px] text-body-soft">{r.city}</span>
              <span className="text-sm font-black text-amber-400">{r.range}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-line-subtle flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-faint mt-0.5 shrink-0" />
          <p className="text-[10px] text-faint italic leading-relaxed">
            Chiffres indicatifs à titre de repère général, susceptibles de varier fortement selon le quartier et
            l&apos;état du bien — à vérifier auprès d&apos;une agence locale avant toute décision.
          </p>
        </div>
      </div>
    </div>
  );
}
