'use client';

import { useMemo } from 'react';
import { AlertTriangle, Clock, Copy } from 'lucide-react';

interface SubscriptionForAlert {
  id: string;
  name: string;
  subCategory: string | null;
  price: number;
  isActive: boolean;
  createdAt: string;
  activeMonths: number;
}

interface Props {
  subscriptions: SubscriptionForAlert[];
}

const formatCUR = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

const LONG_RUNNING_MONTHS = 12;

// Purement dérivé des données déjà chargées par la page (voir
// app/api/subscriptions), aucun appel réseau supplémentaire. Deux signaux :
// 1) doublons — plusieurs abonnements actifs dans la même sous-catégorie
//    (ex: deux services de streaming vidéo) ;
// 2) longue date — abonnement actif depuis plus d'un an, jamais revu depuis
//    (pas de signal d'usage réel disponible, donc un simple "toujours
//    utile ?" plutôt qu'une affirmation qu'il est vraiment oublié).
export default function SubscriptionAlerts({ subscriptions }: Props) {
  const { duplicateGroups, longRunning } = useMemo(() => {
    const active = subscriptions.filter((s) => s.isActive);

    const bySubCategory = new Map<string, SubscriptionForAlert[]>();
    for (const s of active) {
      const key = s.subCategory?.trim() || null;
      if (!key) continue; // pas de sous-catégorie renseignée = pas de base de comparaison fiable
      if (!bySubCategory.has(key)) bySubCategory.set(key, []);
      bySubCategory.get(key)!.push(s);
    }
    const duplicateGroups = [...bySubCategory.entries()]
      .filter(([, subs]) => subs.length >= 2)
      .map(([subCategory, subs]) => ({ subCategory, subs: subs.sort((a, b) => b.price - a.price) }));

    const longRunning = active
      .filter((s) => s.activeMonths >= LONG_RUNNING_MONTHS)
      .sort((a, b) => b.activeMonths - a.activeMonths);

    return { duplicateGroups, longRunning };
  }, [subscriptions]);

  if (duplicateGroups.length === 0 && longRunning.length === 0) return null;

  return (
    <div className="p-6 border bg-amber-500/5 rounded-2xl border-amber-500/20 space-y-4">
      <div className="flex items-center gap-4">
        <div className="p-3 border bg-amber-600/20 rounded-xl border-amber-500/20">
          <AlertTriangle className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h2 className="text-sm font-black tracking-tight uppercase text-amber-400">
            À vérifier
          </h2>
          <p className="text-subtle text-xs mt-0.5">Doublons potentiels et abonnements de longue date.</p>
        </div>
      </div>

      {duplicateGroups.length > 0 && (
        <div className="space-y-2">
          {duplicateGroups.map((group) => (
            <div key={group.subCategory} className="p-3 bg-surface border border-line rounded-xl">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mb-1.5">
                <Copy className="w-3.5 h-3.5" />
                {group.subs.length} abonnements &quot;{group.subCategory}&quot; actifs en même temps
              </div>
              <p className="text-[12px] text-subtle">
                {group.subs.map((s) => `${s.name} (${formatCUR(s.price)}/mois)`).join(' · ')}
              </p>
            </div>
          ))}
        </div>
      )}

      {longRunning.length > 0 && (
        <div className="space-y-2">
          {longRunning.map((s) => (
            <div key={s.id} className="p-3 bg-surface border border-line rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-xs text-body-soft min-w-0">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-bold truncate">{s.name}</span>
                <span className="text-faint shrink-0">— actif depuis {s.activeMonths} mois, toujours utile ?</span>
              </div>
              <span className="text-xs font-mono text-body-soft shrink-0">{formatCUR(s.price)}/mois</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
