"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

interface Props {
  referenceIncome: number;
  emergencyFundBalance: number;
  portfolioValue: number;
  totalGoalsTarget: number;
  totalGoalsSaved: number;
}

interface Advice {
  banques: string;
  investissementMaroc: string;
  investissementInternational: string;
  erreursFatales: string;
}

const BLOCK_META = [
  { key: "banques" as const, emoji: "🏦", title: "Banques & Épargne" },
  {
    key: "investissementMaroc" as const,
    emoji: "📈",
    title: "Investissement au Maroc",
  },
  {
    key: "investissementInternational" as const,
    emoji: "🌍",
    title: "Investissement International",
  },
  { key: "erreursFatales" as const, emoji: "⚠️", title: "Erreurs Fatales" },
];

export default function TangerFinancialAdvice({
  referenceIncome,
  emergencyFundBalance,
  portfolioValue,
  totalGoalsTarget,
  totalGoalsSaved,
}: Props) {
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/coach/tanger-advice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        referenceIncome,
        emergencyFundBalance,
        portfolioValue,
        totalGoalsTarget,
        totalGoalsSaved,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Request failed");
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
  }, [
    referenceIncome,
    emergencyFundBalance,
    portfolioValue,
    totalGoalsTarget,
    totalGoalsSaved,
  ]);

  return (
    <div className="bg-[#1b253b] rounded-2xl border border-slate-700 p-8">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-xl font-bold text-white tracking-tight">
          Conseils Financiers
        </h2>
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
                <p className="text-[13px] text-slate-400 leading-relaxed">
                  {advice[b.key]}
                </p>
              </div>
            ))}
          </div>
          {generatedAt && (
            <p className="text-[10px] text-slate-600 italic pt-6">
              Analyse générée le{" "}
              {new Date(generatedAt).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
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
        <p className="text-sm font-bold text-slate-200">🏦 Banques & Épargne</p>
        <p className="text-[13px] text-slate-400 leading-relaxed">
          Privilégiez les banques sans frais comme CIH Bank (Code30) ou
          Attijariwafa (L&apos;bankalik) pour séparer l&apos;argent de vos
          dépenses courantes de l&apos;épargne. Le Plan Épargne Logement (PEL)
          est intéressant pour acheter un appartement à Tanger avec un taux
          préférentiel fiscalement.
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-bold text-slate-200">
          📈 Investissement au Maroc
        </p>
        <p className="text-[13px] text-slate-400 leading-relaxed">
          Bourse de Casablanca (MASI) via votre banque ou application de
          courtage. Privilégiez les grandes capitalisations (IAM, Attijariwafa,
          LafargeHolcim) qui versent des dividendes réguliers. Les OPCVM sont
          une option managée mais surveillez les frais d&apos;entrée !
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-bold text-slate-200">
          🌍 Investissement International
        </p>
        <p className="text-[13px] text-slate-400 leading-relaxed">
          Diversifiez votre risque ! Selon la législation de l&apos;Office des
          Changes, utilisez votre dotation e-commerce ou touristique pour
          investir périodiquement (DCA) sur des ETF mondiaux via des courtiers.
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-bold text-slate-200">⚠️ Erreurs Fatales</p>
        <p className="text-[13px] text-slate-400 leading-relaxed">
          Ne prenez JAMAIS un crédit consommation (taux &gt; 12%) pour investir
          en bourse ou en crypto ! N&apos;investissez pas l&apos;argent du mois
          ou votre fonds d&apos;urgence. Le marché est fait pour l&apos;argent
          dont vous n&apos;aurez pas besoin pendant 5 ans minimum.
        </p>
      </div>
    </div>
  );
}
