'use client';

import { CalendarRange } from 'lucide-react';
import { useLanguage } from './LanguageProvider';

interface Cycle {
  cycleStart: string;
  cycleEnd: string;
  committedOutflowMad: number;
}

const formatMAD = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

// Vue sur les prochains cycles de paie (voir getMultiCycleOutlook dans
// lib/billCalendar.ts) — repère un cycle futur anormalement chargé (facture
// trimestrielle, renouvellement annuel...) avant qu'il n'arrive. Purement
// informatif, pas de solde ici, juste le total des échéances par cycle.
export default function MultiCycleOutlook({ cycles }: { cycles: Cycle[] }) {
  const { t } = useLanguage();

  if (cycles.length === 0) return null;
  const maxOutflow = Math.max(...cycles.map((c) => c.committedOutflowMad), 1);

  return (
    <div className="p-6 border bg-surface rounded-2xl border-line">
      <div className="flex items-center gap-2 mb-4">
        <CalendarRange className="w-4 h-4 text-indigo-400" />
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-subtle">
          {t('calendar.multiCycle.title')}
        </h3>
      </div>
      <div className="space-y-3">
        {cycles.map((c, i) => (
          <div key={c.cycleEnd}>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-subtle">
                {i === 0
                  ? t('calendar.multiCycle.thisCycle')
                  : `${t('calendar.multiCycle.cycleUntil')} ${new Date(c.cycleEnd).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
              </span>
              <span className="font-bold text-body tabular-nums">{formatMAD(c.committedOutflowMad)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-alt overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{ width: `${Math.max(4, (c.committedOutflowMad / maxOutflow) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
