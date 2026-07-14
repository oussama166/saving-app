import { Landmark, LineChart, Building2, Info } from 'lucide-react';

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
  return (
    <div className="space-y-6">
      <div className="bg-[#1b253b] rounded-2xl border border-slate-700 p-8">
        <div className="flex items-center gap-3 mb-6">
          <Landmark className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-bold text-white tracking-tight">Banques</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="pb-3 font-bold">Banque</th>
                <th className="pb-3 font-bold">Frais</th>
                <th className="pb-3 font-bold">Points forts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {BANKS.map((b) => (
                <tr key={b.name}>
                  <td className="py-3 font-bold text-slate-200">{b.name}</td>
                  <td className="py-3 text-slate-400">{b.fees}</td>
                  <td className="py-3 text-slate-400">{b.highlight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-[#1b253b] rounded-2xl border border-slate-700 p-8">
        <div className="flex items-center gap-3 mb-6">
          <LineChart className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-bold text-white tracking-tight">Courtiers (Bourse de Casablanca)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {BROKERS.map((b) => (
            <div key={b.name} className="p-4 rounded-xl bg-slate-900/50 border border-slate-700/50">
              <p className="text-sm font-bold text-slate-200 mb-1.5">{b.name}</p>
              <p className="text-[12px] text-slate-400 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#1b253b] rounded-2xl border border-slate-700 p-8">
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-bold text-white tracking-tight">Prix Immobilier (ordres de grandeur)</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {REAL_ESTATE.map((r) => (
            <div key={r.city} className="p-4 rounded-xl bg-slate-900/50 border border-slate-700/50 flex justify-between items-center">
              <span className="text-[13px] text-slate-300">{r.city}</span>
              <span className="text-sm font-black text-amber-400">{r.range}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-slate-600 mt-0.5 shrink-0" />
          <p className="text-[10px] text-slate-600 italic leading-relaxed">
            Chiffres indicatifs à titre de repère général, susceptibles de varier fortement selon le quartier et
            l&apos;état du bien — à vérifier auprès d&apos;une agence locale avant toute décision.
          </p>
        </div>
      </div>
    </div>
  );
}
