"use client";

import { Sparkles } from "lucide-react";
import { useLanguage } from "./LanguageProvider";
import { useCoachAdvice } from "../hooks/useCoachAdvice";
import { tangerAdviceSchema, type TangerAdvice } from "@/lib/coachSchemas";
import CoachRegenerateButton from "./CoachRegenerateButton";

interface Props {
  referenceIncome: number;
  emergencyFundBalance: number;
  portfolioValue: number;
  totalGoalsTarget: number;
  totalGoalsSaved: number;
}

export default function TangerFinancialAdvice({
  referenceIncome,
  emergencyFundBalance,
  portfolioValue,
  totalGoalsTarget,
  totalGoalsSaved,
}: Props) {
  const { t } = useLanguage();
  const { advice, loading, regenerating, failed, generatedAt, regenerate } = useCoachAdvice(
    "/api/coach/tanger-advice",
    tangerAdviceSchema,
    { referenceIncome, emergencyFundBalance, portfolioValue, totalGoalsTarget, totalGoalsSaved },
  );

  const BLOCK_META: { key: keyof TangerAdvice; emoji: string; title: string }[] = [
    { key: "banques", emoji: "🏦", title: t("coach.tanger.banques") },
    { key: "investissementMaroc", emoji: "📈", title: t("coach.tanger.investMaroc") },
    { key: "investissementInternational", emoji: "🌍", title: t("coach.tanger.investIntl") },
    { key: "erreursFatales", emoji: "⚠️", title: t("coach.tanger.erreurs") },
  ];

  const complete = Boolean(
    advice?.banques && advice?.investissementMaroc && advice?.investissementInternational && advice?.erreursFatales,
  );

  return (
    <div className="bg-surface rounded-2xl border border-line p-8">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-xl font-bold text-ink tracking-tight">{t("coach.tanger.title")}</h2>
        <div className="ml-auto flex items-center gap-3">
          {loading && (
            <span className="flex items-center gap-1.5 text-[10px] text-blue-400 font-bold uppercase tracking-widest">
              <Sparkles className="w-3 h-3 animate-pulse" />
              {t("coach.analyzing")}
            </span>
          )}
          {!loading && complete && !failed && (
            <>
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
                <Sparkles className="w-3 h-3" />
                {t("coach.aiCoach")}
              </span>
              <CoachRegenerateButton onClick={regenerate} loading={regenerating} />
            </>
          )}
        </div>
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
      ) : complete && !failed ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {BLOCK_META.map((b) => (
              <div key={b.key} className="space-y-2">
                <p className="text-sm font-bold text-body">
                  {b.emoji} {b.title}
                </p>
                <p className="text-[13px] text-muted leading-relaxed">{advice?.[b.key]}</p>
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
