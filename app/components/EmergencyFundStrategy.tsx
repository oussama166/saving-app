'use client';

import { useEffect, useState } from 'react';
import { Compass, Sparkles } from 'lucide-react';

interface Props {
  emergencyFundBalance: number;
  emergencyFundTarget: number;
  emergencyFundTargetMonths: number;
  monthsCovered: number;
  avgMonthlyExpenses: number;
}

interface Advice {
  objectif: string;
  methode: string;
  recommandations: string[];
}

export default function EmergencyFundStrategy({
  emergencyFundBalance,
  emergencyFundTarget,
  emergencyFundTargetMonths,
  monthsCovered,
  avgMonthlyExpenses,
}: Props) {
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/coach/emergency-fund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emergencyFundBalance,
        emergencyFundTarget,
        emergencyFundTargetMonths,
        monthsCovered,
        avgMonthlyExpenses,
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
  }, [emergencyFundBalance, emergencyFundTarget, emergencyFundTargetMonths, monthsCovered, avgMonthlyExpenses]);

  return (
    <div className="bg-[#1b253b] rounded-xl border border-slate-700 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Compass className="w-6 h-6 text-blue-400" />
        <h3 className="text-lg font-bold text-slate-200">Stratégie & Conseils</h3>
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
        <div className="space-y-3 animate-pulse">
          <div className="h-3 bg-slate-800 rounded w-full" />
          <div className="h-3 bg-slate-800 rounded w-5/6" />
          <div className="h-3 bg-slate-800 rounded w-4/6" />
          <div className="h-3 bg-slate-800 rounded w-full mt-4" />
          <div className="h-3 bg-slate-800 rounded w-3/6" />
        </div>
      ) : advice && !failed ? (
        <div className="space-y-4 text-[13px] leading-relaxed text-slate-400">
          <p>
            <span className="font-bold text-slate-200">Diagnostic :</span> {advice.objectif}
          </p>
          <p>
            <span className="font-bold text-slate-200">La Méthode :</span> {advice.methode}
          </p>
          <div>
            <p className="font-bold text-slate-200 mb-2">Recommandations :</p>
            <ul className="space-y-1.5 list-disc list-inside marker:text-blue-400">
              {advice.recommandations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
          {generatedAt && (
            <p className="text-[10px] text-slate-600 italic pt-1">
              Analyse générée le{' '}
              {new Date(generatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
              , actualisée une fois par semaine.
            </p>
          )}
        </div>
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
    <div className="space-y-4 text-[13px] leading-relaxed text-slate-400">
      <p>
        <span className="font-bold text-slate-200">L&apos;Objectif :</span> Constituer une réserve
        liquide capable de couvrir entre 3 et 6 mois de vos dépenses vitales en cas d&apos;imprévu
        (perte d&apos;emploi, accident, etc.).
      </p>
      <p>
        <span className="font-bold text-slate-200">La Méthode :</span> Virez automatiquement 500
        DH/mois minimum vers ce compte dès réception de votre salaire.
      </p>
      <div>
        <p className="font-bold text-slate-200 mb-2">Placements Recommandés au Maroc :</p>
        <ul className="space-y-1.5 list-disc list-inside marker:text-blue-400">
          <li>Livret Épargne CIH (liquide, 0 frais)</li>
          <li>Compte sur Carnet Attijariwafa</li>
          <li>Bons du Trésor à court terme (si capital &gt; 10k DH)</li>
        </ul>
      </div>
    </div>
  );
}
