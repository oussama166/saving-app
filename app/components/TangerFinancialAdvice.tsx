"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useLanguage } from "./LanguageProvider";

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

export default function TangerFinancialAdvice({
  referenceIncome,
  emergencyFundBalance,
  portfolioValue,
  totalGoalsTarget,
  totalGoalsSaved,
}: Props) {
  const { t } = useLanguage();
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const BLOCK_META = [
    { key: "banques" as const, emoji: "🏦", title: t("coach.tanger.banques") },
    {
      key: "investissementMaroc" as const,
      emoji: "📈",
      title: t("coach.tanger.investMaroc"),
    },
    {
      key: "investissementInternational" as const,
      emoji: "🌍",
      title: t("coach.tanger.investIntl"),
    },
    { key: "erreursFatales" as const, emoji: "⚠️", title: t("coach.tanger.erreurs") },
  ];

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
    <div className="bg-surface rounded-2xl border border-line p-8">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-xl font-bold text-ink tracking-tight">
          {t("coach.tanger.title")}
        </h2>
        {loading && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-blue-400 font-bold uppercase tracking-widest">
            <Sparkles className="w-3 h-3 animate-pulse" />
            {t("coach.analyzing")}
          </span>
        )}
        {!loading && advice && !failed && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
            <Sparkles className="w-3 h-3" />
            {t("coach.aiCoach")}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          {BLOCK_META.map((b) => (
            <div key={b.key} className="space-y-2">
              <div className="h-3 bg-surface-alt rounded w-1/2" />
              <div className="h-3 bg-surface-alt rounded w-full" />
              <div className="h-3 bg-surface-alt rounded w-5/6" />
            </div>
          ))}
        </div>
      ) : advice && !failed ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {BLOCK_META.map((b) => (
              <div key={b.key} className="space-y-2">
                <p className="text-sm font-bold text-body">
                  {b.emoji} {b.title}
                </p>
                <p className="text-[13px] text-muted leading-relaxed">
                  {advice[b.key]}
                </p>
              </div>
            ))}
          </div>
          {generatedAt && (
            <p className="text-[10px] text-faint italic pt-6">
              {t("coach.generatedOn")}{" "}
              {new Date(generatedAt).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
              , {t("coach.weeklyRefresh")}
            </p>
          )}
        </>
      ) : (
        <StaticFallback t={t} />
      )}
    </div>
  );
}

// Contenu générique conservé comme repli si l'appel au Coach IA échoue
// (clé API manquante, quota dépassé, erreur réseau...).
function StaticFallback({ t }: { t: ReturnType<typeof useLanguage>["t"] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-2">
        <p className="text-sm font-bold text-body">🏦 {t("coach.tanger.banques")}</p>
        <p className="text-[13px] text-muted leading-relaxed">{t("coach.tanger.staticBanques")}</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-bold text-body">📈 {t("coach.tanger.investMaroc")}</p>
        <p className="text-[13px] text-muted leading-relaxed">{t("coach.tanger.staticInvestMaroc")}</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-bold text-body">🌍 {t("coach.tanger.investIntl")}</p>
        <p className="text-[13px] text-muted leading-relaxed">{t("coach.tanger.staticInvestIntl")}</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-bold text-body">⚠️ {t("coach.tanger.erreurs")}</p>
        <p className="text-[13px] text-muted leading-relaxed">{t("coach.tanger.staticErreurs")}</p>
      </div>
    </div>
  );
}
