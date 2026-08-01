'use client';

import { Check, Compass, PieChart, BarChart3, Wallet, Gauge, Target, Mail, SlidersHorizontal, BookOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { BUDGET_METHOD_ORDER, getBudgetMethodDef } from '@/lib/budgetMethods';

interface BudgetMethodSelectorProps {
  value: string;
  onChange: (key: string) => void;
}

const METHOD_ICONS: Record<string, LucideIcon> = {
  '503020': PieChart,
  '702010': BarChart3,
  payYourselfFirst: Wallet,
  '60solution': Gauge,
  zeroBased: Target,
  envelope: Mail,
  custom: SlidersHorizontal,
  kakeibo: BookOpen,
};

// Sélecteur de méthodologie de budget (page Profil) — 8 cartes cliquables,
// une par entrée du registre lib/budgetMethods.ts. Purement un réglage
// (UserSettings.budgetMethod), aucune donnée n'est recalculée ou perdue en
// changeant : les méthodes "ratio" se recalculent à la volée depuis les
// transactions existantes, les méthodes "allocation" réutilisent le même
// budgetPct par catégorie quel que soit le choix.
export default function BudgetMethodSelector({ value, onChange }: BudgetMethodSelectorProps) {
  const { t } = useLanguage();

  return (
    <div className="bg-surface rounded-2xl border border-line p-6 sm:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 border bg-blue-600/20 rounded-xl border-blue-500/20 shrink-0">
          <Compass className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h3 className="text-base font-bold text-ink">{t('budgetMethod.selector.title')}</h3>
          <p className="text-[12px] text-subtle mt-0.5">{t('budgetMethod.selector.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {BUDGET_METHOD_ORDER.map((key) => {
          const def = getBudgetMethodDef(key);
          const active = value === key;
          const Icon = METHOD_ICONS[key] ?? PieChart;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              aria-pressed={active}
              className={`text-start p-4 rounded-xl border transition-colors flex flex-col gap-2 ${
                active ? 'border-blue-500 bg-blue-500/10' : 'border-line bg-page hover:border-line-strong'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-400' : 'text-subtle'}`} />
                  <span className="text-sm font-bold text-ink truncate">{t(def.labelKey)}</span>
                </div>
                {active && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
              </div>
              <p className="text-[11px] text-subtle leading-relaxed">{t(def.descriptionKey)}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
