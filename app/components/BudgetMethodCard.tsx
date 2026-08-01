"use client";

import Link from "next/link";
import { Target, LayoutGrid, ArrowRight } from "lucide-react";
import { useLanguage } from "./LanguageProvider";
import KakeiboCard from "./KakeiboCard";

interface BudgetMethodBucketResult {
  key: string;
  labelKey: string;
  targetPct: number;
  targetAmount: number;
  actualAmount: number;
  actualPct: number;
  subNoteKey?: string;
}

interface BudgetMethodResult {
  key: string;
  kind: "ratio" | "allocation" | "journal";
  totalBasis: number;
  buckets: BudgetMethodBucketResult[];
}

interface BudgetDetail {
  categoryName: string;
  allocationPct: number;
  usedPct: number;
}

interface BudgetMethodCardProps {
  method: string;
  kind: "ratio" | "allocation" | "journal";
  result: BudgetMethodResult | null;
  totals: { essential: number; discretionary: number; savings: number };
  budgetDetails: BudgetDetail[];
}

const BUCKET_COLORS: Record<string, string> = {
  essential: "bg-blue-500",
  committed: "bg-blue-500",
  discretionary: "bg-purple-500",
  savings: "bg-emerald-500",
  free: "bg-purple-500",
  flexible: "bg-purple-500",
};

const BUCKET_TEXT_COLORS: Record<string, string> = {
  essential: "text-blue-400",
  committed: "text-blue-400",
  discretionary: "text-purple-400",
  savings: "text-emerald-400",
  free: "text-purple-400",
  flexible: "text-purple-400",
};

const formatMAD = (amt: number) =>
  new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(
    amt,
  );

// Carte "méthode de budget" du Dashboard — généralise l'ancienne
// Rule503020Card (fixée sur 50/30/20) à toute méthode du registre
// lib/budgetMethods.ts, choisie sur la page Profil. Trois rendus possibles
// selon `kind` : barres cible/réel pour les méthodes en ratio, résumé de
// l'allocation par catégorie pour Base zéro/Enveloppes/Personnalisé (le
// détail vit déjà dans DetailedBudgetTable, pas dupliqué ici), journal
// Kakeibo pour la méthode japonaise.
export default function BudgetMethodCard({
  method,
  kind,
  result,
  totals,
  budgetDetails,
}: BudgetMethodCardProps) {
  const { t } = useLanguage();

  if (kind === "journal") {
    return <KakeiboCard totals={totals} />;
  }

  if (kind === "allocation") {
    const totalAllocatedPct = budgetDetails.reduce(
      (acc, b) => acc + b.allocationPct,
      0,
    );
    const overBudgetCount = budgetDetails.filter((b) => b.usedPct > 90).length;
    const methodLabelKey = `budgetMethod.${method}.label`;
    const frameKey =
      method === "envelope"
        ? "budgetMethod.allocation.envelopeFrame"
        : method === "zeroBased"
          ? "budgetMethod.allocation.zeroBasedFrame"
          : "budgetMethod.allocation.customFrame";

    return (
      <div className="bg-surface-alt/50 border border-line p-6 rounded-2xl flex flex-col gap-4">
        <div className="flex justify-between items-center gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <LayoutGrid className="w-4 h-4 text-muted shrink-0" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted truncate">
              {t(methodLabelKey)}
            </h3>
          </div>
          <Link
            href="/profil"
            className="flex items-center gap-1 text-[10px] bg-surface-strong text-muted px-2 py-1 rounded uppercase font-bold hover:text-body-soft transition-colors shrink-0"
          >
            {t("budgetMethod.card.changeMethod")}
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <p className="text-[11px] text-subtle leading-relaxed">{t(frameKey)}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-surface-deep/50 rounded-xl border border-line/50">
            <p className="text-[10px] uppercase font-bold text-subtle tracking-widest">
              {t("budgetMethod.allocation.totalAllocated")}
            </p>
            <p className="text-lg font-bold text-ink mt-1 tabular-nums">
              {Math.round(totalAllocatedPct)}%
            </p>
          </div>
          <div className="p-3 bg-surface-deep/50 rounded-xl border border-line/50">
            <p className="text-[10px] uppercase font-bold text-subtle tracking-widest">
              {t("budgetMethod.allocation.overBudget")}
            </p>
            <p
              className={`text-lg font-bold mt-1 tabular-nums ${overBudgetCount > 0 ? "text-red-400" : "text-emerald-400"}`}
            >
              {overBudgetCount}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // kind === 'ratio'
  if (!result) return null;

  return (
    <div className="bg-surface-alt/50 border border-line p-6 rounded-2xl flex flex-col gap-6">
      <div className="flex justify-between items-center gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Target className="w-4 h-4 text-muted shrink-0" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted truncate">
            {t(`budgetMethod.${method}.label`)}
          </h3>
        </div>
        <Link
          href="/profil"
          className="flex items-center gap-1 text-[10px] bg-surface-strong text-muted px-2 py-1 rounded uppercase font-bold hover:text-body-soft transition-colors shrink-0"
        >
          {t("budgetMethod.card.changeMethod")}
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-6">
        {result.buckets.map((bucket) => {
          const over =
            bucket.key !== "savings" && bucket.actualPct > bucket.targetPct;
          const barColor = over
            ? "bg-red-500"
            : (BUCKET_COLORS[bucket.key] ?? "bg-blue-500");
          return (
            <div key={bucket.key} className="space-y-2">
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${BUCKET_COLORS[bucket.key] ?? "bg-blue-500"}`}
                  />
                  <span
                    className={`text-xs font-semibold truncate ${BUCKET_TEXT_COLORS[bucket.key] ?? "text-body-soft"}`}
                  >
                    {t(bucket.labelKey)}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 shrink-0">
                  <span className="text-[10px] text-faint font-medium tabular-nums">
                    {formatMAD(bucket.actualAmount)}
                  </span>
                  <span
                    className={`text-xs font-bold tabular-nums ${over ? "text-red-400" : "text-muted"}`}
                  >
                    {bucket.actualPct}%
                  </span>
                </div>
              </div>
              <div className="w-full bg-surface-strong h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                  style={{ width: `${Math.min(bucket.actualPct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-subtle font-bold uppercase tracking-tighter">
                <span>0%</span>
                <span>
                  {t("dashboard.card2.target")}
                  {bucket.targetPct}%
                </span>
              </div>
              {bucket.subNoteKey && (
                <p className="text-[10px] text-subtle italic leading-relaxed">
                  {t(bucket.subNoteKey)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
