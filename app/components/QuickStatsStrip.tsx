import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { Flame, CalendarDays } from "lucide-react";

// Petit récap en haut de Saisie : dépenses du jour et de la semaine en
// cours, pour donner un repère immédiat avant de saisir/consulter — le
// Dashboard a déjà ce genre de métriques mais sur le cycle budgétaire
// complet (mois), pas sur "aujourd'hui" au jour le jour. Composant serveur
// pur, les deux totaux sont déjà calculés par app/saisie/page.tsx (voir
// getTransactionsPage avec dateFrom).
export default function QuickStatsStrip({
  todaySpent,
  weekSpent,
  locale,
}: {
  todaySpent: number;
  weekSpent: number;
  locale: Locale;
}) {
  const formatMAD = (amt: number) =>
    new Intl.NumberFormat("fr-MA", {
      style: "currency",
      currency: "MAD",
    }).format(amt);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="p-4 rounded-xl border bg-surface border-line flex items-center gap-3">
        <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 shrink-0">
          <Flame className="w-4 h-4 text-orange-400" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-subtle truncate">
            {t(locale, "saisie.spentToday")}
          </p>
          <p className="text-base font-bold text-ink tabular-nums">
            {formatMAD(todaySpent)}
          </p>
        </div>
      </div>
      <div className="p-4 rounded-xl border bg-surface border-line flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 shrink-0">
          <CalendarDays className="w-4 h-4 text-blue-400" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-subtle truncate">
            {t(locale, "saisie.spentThisWeek")}
          </p>
          <p className="text-base font-bold text-ink tabular-nums">
            {formatMAD(weekSpent)}
          </p>
        </div>
      </div>
    </div>
  );
}
