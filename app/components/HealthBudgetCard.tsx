"use client";

import { HeartPulse } from "lucide-react";
import type { HealthBudget } from "@/lib/financials";
import { useLanguage } from "./LanguageProvider";

interface Props {
  budget: HealthBudget;
}

export default function HealthBudgetCard({ budget }: Props) {
  const usedPct =
    budget.plannedMonthly > 0
      ? Math.min((budget.spentThisMonth / budget.plannedMonthly) * 100, 100)
      : 0;
  const overBudget = budget.remaining < 0;
  const { t, locale } = useLanguage();
  const formatCUR = (val: number) => {
    return new Intl.NumberFormat(`${locale}-MA`, {
      style: "currency",
      currency: "MAD",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="p-8 space-y-6 border shadow-2xl bg-surface rounded-2xl border-line">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HeartPulse className="w-6 h-6 text-rose-400" />
          <h2 className="text-xl font-bold tracking-tight text-ink">
            {t("health.body.title")}
          </h2>
          {/* <h2 className="text-xl font-bold tracking-tight text-ink">{budget.}</h2> */}
        </div>
        <span className="text-[10px] bg-rose-500/20 text-rose-400 px-2 py-1 rounded uppercase font-bold tracking-widest border border-rose-500/20">
          {budget.budgetPct}% {t("health.body.of_income")}
        </span>
      </div>

      <div>
        <div className="flex items-end justify-between mb-2">
          <span className="text-3xl font-bold text-body">
            {formatCUR(budget.spentThisMonth)}
          </span>
          <span className="mb-1 text-sm font-medium text-subtle">
            {t("health.body.foreseen")} : {formatCUR(budget.plannedMonthly)}
          </span>
        </div>
        <div className="w-full h-4 overflow-hidden border rounded-full bg-page border-line-subtle">
          <div
            className={`h-full transition-all duration-1000 ease-out ${overBudget ? "bg-red-500" : "bg-rose-400"}`}
            style={{ width: `${usedPct}%` }}
          />
        </div>
        <p
          className={`text-right text-xs font-bold mt-2 uppercase tracking-wider ${
            overBudget ? "text-red-400" : "text-rose-400"
          }`}
        >
          {usedPct.toFixed(1)}% {t("health.body.budget_used")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="p-4 border bg-surface-deep/50 rounded-xl border-line/50">
          <span className="text-[10px] text-subtle font-bold uppercase tracking-widest">
            {t("health.body.remaining")}
          </span>
          <p
            className={`text-lg font-bold mt-1 ${overBudget ? "text-red-400" : "text-emerald-400"}`}
          >
            {formatCUR(budget.remaining)}
          </p>
        </div>
        <div className="p-4 border bg-surface-deep/50 rounded-xl border-line/50">
          <span className="text-[10px] text-subtle font-bold uppercase tracking-widest">
            {t("health.body.annual_est")}
          </span>
          <p className="mt-1 text-lg font-bold text-body-soft">
            {formatCUR(budget.estimatedAnnual)}
          </p>
        </div>
        <div className="p-4 border bg-surface-deep/50 rounded-xl border-line/50">
          <span className="text-[10px] text-subtle font-bold uppercase tracking-widest">
            {t("health.body.weight_on_income")}
          </span>
          <p className="mt-1 text-lg font-bold text-body-soft">
            {budget.weightOnIncomePct}%
          </p>
        </div>
      </div>
    </div>
  );
}
