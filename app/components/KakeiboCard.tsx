"use client";

import { useState, useEffect, useRef } from "react";
import { BookOpen, Check } from "lucide-react";
import { useLanguage } from "./LanguageProvider";

interface KakeiboCardProps {
  totals: { essential: number; discretionary: number; savings: number };
}

interface KakeiboData {
  reflection1: string;
  reflection2: string;
  reflection3: string;
  reflection4: string;
}

const EMPTY: KakeiboData = {
  reflection1: "",
  reflection2: "",
  reflection3: "",
  reflection4: "",
};

// Carte Kakeibo (méthode budgétaire japonaise) — 4 questions de réflexion
// mensuelle, sauvegardées automatiquement (debounce 800ms) via PUT
// /api/kakeibo. Les 3 totaux du cycle en cours (essentiel/discrétionnaire/
// épargne, déjà calculés côté dashboard) sont affichés en repère avant les
// questions, sans dupliquer de logique de calcul ici.
export default function KakeiboCard({ totals }: KakeiboCardProps) {
  const { t } = useLanguage();
  const [data, setData] = useState<KakeiboData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/kakeibo")
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setData(result.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatMAD = (amt: number) =>
    new Intl.NumberFormat("fr-MA", {
      style: "currency",
      currency: "MAD",
    }).format(amt);

  const scheduleSave = (next: KakeiboData) => {
    setData(next);
    setSaved(false);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      try {
        await fetch("/api/kakeibo", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        setSaved(true);
      } catch {
        // silencieux — la prochaine frappe redéclenchera une tentative
      }
    }, 800);
  };

  const questions: { field: keyof KakeiboData; labelKey: string }[] = [
    { field: "reflection1", labelKey: "kakeibo.q1" },
    { field: "reflection2", labelKey: "kakeibo.q2" },
    { field: "reflection3", labelKey: "kakeibo.q3" },
    { field: "reflection4", labelKey: "kakeibo.q4" },
  ];

  if (loading) {
    return (
      <div className="bg-surface-alt/50 border border-line p-6 rounded-2xl">
        <div className="w-5 h-5 border-2 border-line-strong border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-surface-alt/50 border border-line p-6 rounded-2xl flex flex-col gap-5">
      <div className="flex justify-between items-center gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 shrink-0">
            <BookOpen className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted truncate">
            {t("budgetMethod.kakeibo.label")}
          </h3>
        </div>
        <span
          className={`flex items-center gap-1 text-[10px] text-emerald-400 font-bold uppercase tracking-widest shrink-0 transition-opacity duration-300 ${
            saved ? "opacity-100" : "opacity-0"
          }`}
        >
          <Check className="w-3 h-3" />
          {t("common.saved")}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 bg-surface-deep/50 rounded-lg border border-line/50 text-center">
          <p className="text-[9px] uppercase font-bold text-blue-400/80 tracking-widest">
            {t("budgetMethod.bucket.needs")}
          </p>
          <p className="text-xs font-bold text-ink mt-1 tabular-nums">
            {formatMAD(totals.essential)}
          </p>
        </div>
        <div className="p-2.5 bg-surface-deep/50 rounded-lg border border-line/50 text-center">
          <p className="text-[9px] uppercase font-bold text-purple-400/80 tracking-widest">
            {t("budgetMethod.bucket.wants")}
          </p>
          <p className="text-xs font-bold text-ink mt-1 tabular-nums">
            {formatMAD(totals.discretionary)}
          </p>
        </div>
        <div className="p-2.5 bg-surface-deep/50 rounded-lg border border-line/50 text-center">
          <p className="text-[9px] uppercase font-bold text-emerald-400/80 tracking-widest">
            {t("budgetMethod.bucket.savings")}
          </p>
          <p className="text-xs font-bold text-ink mt-1 tabular-nums">
            {formatMAD(totals.savings)}
          </p>
        </div>
      </div>

      <div className="space-y-3 pt-1 border-t border-line-subtle">
        {questions.map((q, i) => (
          <div key={q.field} className="flex flex-col gap-1.5 pt-3 first:pt-0">
            <label className="text-[10px] uppercase font-bold text-subtle tracking-widest">
              <span className="text-orange-400/70 mr-1">{i + 1}.</span>
              {t(q.labelKey)}
            </label>
            <textarea
              value={data[q.field]}
              onChange={(e) =>
                scheduleSave({ ...data, [q.field]: e.target.value })
              }
              rows={2}
              className="bg-page border border-line text-body rounded-lg p-2.5 focus:border-orange-500 outline-none transition-colors text-xs resize-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
