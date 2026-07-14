'use client';

import { useEffect, useState } from 'react';
import { ShieldPlus, Sparkles } from 'lucide-react';

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

const BLOCK_META = [
  { key: 'bilanAnnuel' as const, emoji: '🩺', title: 'Bilan de Santé Annuel' },
  { key: 'couvertureCnss' as const, emoji: '🏥', title: 'Couverture CNSS / AMO' },
  { key: 'mutuelle' as const, emoji: '➕', title: 'Mutuelle Complémentaire' },
  { key: 'pharmacieGeneriques' as const, emoji: '💊', title: 'Pharmacie & Génériques' },
];

export default function PreventionCoverage({
  spentThisMonth,
  weightOnIncomePct,
  remaining,
  pendingReimbursementTotal,
  pendingCount,
  recordsCount,
}: Props) {
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

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
    <div className="bg-[#1b253b] rounded-2xl border border-slate-700 p-8">
      <div className="flex items-center gap-3 mb-6">
        <ShieldPlus className="w-6 h-6 text-rose-400" />
        <h2 className="text-xl font-bold text-white tracking-tight">Prévention & Couverture</h2>
        {loading && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-blue-400 font-bold uppercase tracking-widest">
            <Sparkles className="w-3 h-3 animate-pulse" />
            Analyse IA...
          </span>
        )}
        {!loading && advice && !failed && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
            <Sparkles className="w-3 h-3" />
            Coach IA
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          {BLOCK_META.map((b) => (
            <div key={b.key} className="space-y-2">
              <div className="h-3 bg-slate-800 rounded w-1/2" />
              <div className="h-3 bg-slate-800 rounded w-full" />
              <div className="h-3 bg-slate-800 rounded w-5/6" />
            </div>
          ))}
        </div>
      ) : advice && !failed ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {BLOCK_META.map((b) => (
              <div key={b.key} className="space-y-2">
                <p className="text-sm font-bold text-slate-200">
                  {b.emoji} {b.title}
                </p>
                <p className="text-[13px] text-slate-400 leading-relaxed">{advice[b.key]}</p>
              </div>
            ))}
          </div>
          {generatedAt && (
            <p className="text-[10px] text-slate-600 italic pt-6">
              Analyse générée le{' '}
              {new Date(generatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
              , actualisée une fois par semaine.
            </p>
          )}
        </>
      ) : (
        <StaticFallback />
      )}
    </div>
  );
}

// Contenu générique conservé comme repli si l'appel au Coach IA échoue
// (clé API manquante, quota dépassé, erreur réseau...).
function StaticFallback() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-2">
        <p className="text-sm font-bold text-slate-200">🩺 Bilan de Santé Annuel</p>
        <p className="text-[13px] text-slate-400 leading-relaxed">
          Un bilan complet (analyses de sang, tension, glycémie) une fois par an permet de détecter tôt la majorité
          des problèmes chroniques. Beaucoup de laboratoires à Tanger proposent des forfaits bilan à prix réduit.
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-bold text-slate-200">🏥 Couverture CNSS / AMO</p>
        <p className="text-[13px] text-slate-400 leading-relaxed">
          Vérifiez que votre déclaration CNSS est à jour : l&apos;AMO rembourse une partie des consultations,
          analyses et médicaments sur ordonnance. Gardez toujours vos factures et ordonnances pour constituer le
          dossier de remboursement.
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-bold text-slate-200">➕ Mutuelle Complémentaire</p>
        <p className="text-[13px] text-slate-400 leading-relaxed">
          Si votre reste à charge après CNSS est élevé (dentaire, optique, hospitalisation), une mutuelle privée
          complémentaire peut réduire fortement la facture. Comparez les plafonds annuels avant de souscrire.
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-bold text-slate-200">💊 Pharmacie & Génériques</p>
        <p className="text-[13px] text-slate-400 leading-relaxed">
          Demandez systématiquement l&apos;équivalent générique à votre pharmacien : le prix est souvent 30 à 50%
          inférieur au médicament de marque, pour la même molécule.
        </p>
      </div>
    </div>
  );
}
