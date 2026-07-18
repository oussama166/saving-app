"use client";

import { useEffect, useState } from "react";
import { Repeat, Users, Wallet, Loader2 } from "lucide-react";

interface SubStats {
  byName: { name: string; count: number; totalMonthly: number }[];
  totals: { activeCount: number; totalCount: number; totalMonthlySpend: number; usersWithActiveSubscription: number };
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 }).format(n);
}

export default function AdminSubscriptionsPage() {
  const [stats, setStats] = useState<SubStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/subscriptions/stats")
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setStats(result.data);
        else setError(result.error || "Erreur de chargement");
      })
      .catch(() => setError("Erreur réseau"));
  }, []);

  const maxCount = stats ? Math.max(1, ...stats.byName.map((s) => s.count)) : 1;

  return (
    <main className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 text-ink">
      <header>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
          <Repeat className="w-6 h-6 text-amber-400" />
          Abonnements — vue globale
        </h1>
        <p className="text-subtle text-sm mt-1">Popularité et dépense cumulée des abonnements de tous les utilisateurs.</p>
      </header>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[13px]">{error}</div>
      )}

      {!stats && !error && (
        <div className="text-faint text-sm flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
        </div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface border border-line rounded-2xl p-4">
              <div className="flex items-center gap-2 text-faint text-[11px] font-bold uppercase tracking-widest mb-1">
                <Repeat className="w-3.5 h-3.5" /> Abonnements actifs
              </div>
              <div className="text-xl font-black">{stats.totals.activeCount}</div>
            </div>
            <div className="bg-surface border border-line rounded-2xl p-4">
              <div className="flex items-center gap-2 text-faint text-[11px] font-bold uppercase tracking-widest mb-1">
                <Wallet className="w-3.5 h-3.5" /> Dépense mensuelle cumulée
              </div>
              <div className="text-xl font-black">{fmt(stats.totals.totalMonthlySpend)} MAD</div>
            </div>
            <div className="bg-surface border border-line rounded-2xl p-4">
              <div className="flex items-center gap-2 text-faint text-[11px] font-bold uppercase tracking-widest mb-1">
                <Users className="w-3.5 h-3.5" /> Utilisateurs abonnés
              </div>
              <div className="text-xl font-black">{stats.totals.usersWithActiveSubscription}</div>
            </div>
            <div className="bg-surface border border-line rounded-2xl p-4">
              <div className="flex items-center gap-2 text-faint text-[11px] font-bold uppercase tracking-widest mb-1">
                <Repeat className="w-3.5 h-3.5" /> Total (actifs + inactifs)
              </div>
              <div className="text-xl font-black">{stats.totals.totalCount}</div>
            </div>
          </div>

          <div className="bg-surface border border-line rounded-2xl p-5">
            <h2 className="text-[13px] font-bold uppercase tracking-widest text-subtle mb-4">Popularité par service</h2>
            {stats.byName.length === 0 ? (
              <p className="text-faint text-sm">Aucun abonnement actif pour l&apos;instant.</p>
            ) : (
              <div className="space-y-3">
                {stats.byName.map((s) => (
                  <div key={s.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-subtle text-[12px]">
                        {s.count} abonné{s.count === 1 ? "" : "s"} · {fmt(s.totalMonthly)} MAD/mois
                      </span>
                    </div>
                    <div className="w-full bg-surface-strong h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all duration-500"
                        style={{ width: `${(s.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
