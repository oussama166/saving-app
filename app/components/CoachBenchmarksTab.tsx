'use client';

import { Landmark, LineChart, Building2, Info, BookOpen } from 'lucide-react';
import { useLanguage } from './LanguageProvider';

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

export default function CoachBenchmarksTab() {
  const { t } = useLanguage();
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
