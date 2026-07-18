"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Wallet, ArrowLeftRight, Repeat, Target, ShieldAlert, CheckCircle2, XCircle, ArrowRight } from "lucide-react";

interface Stats {
  users: { total: number; verified: number; suspended: number };
  accounts: { total: number; totalBalance: number };
  transactions: { total: number };
  subscriptions: { total: number; active: number };
  savingsGoals: { total: number; totalTarget: number; totalSaved: number };
  system: {
    nodeEnv: string;
    emailConfigured: boolean;
    authSecretConfigured: boolean;
    adminAuthSecretConfigured: boolean;
    siteUrl: string;
  };
}

function fmtMAD(n: number) {
  return new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 }).format(n) + " MAD";
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-5">
      <div className="flex items-center gap-2 text-subtle text-[11px] font-bold uppercase tracking-widest mb-2">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-black text-ink tracking-tight">{value}</div>
      {sub && <div className="text-[12px] text-faint mt-1">{sub}</div>}
    </div>
  );
}

function ConfigRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-line-subtle last:border-0">
      <span className="text-[13px] text-body-soft">{label}</span>
      {ok ? (
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" /> OK
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-red-400">
          <XCircle className="w-3.5 h-3.5" /> Manquant
        </span>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setStats(result.data);
        else setError(result.error || "Erreur de chargement");
      })
      .catch(() => setError("Erreur réseau"));
  }, []);

  return (
    <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 text-ink">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Vue d&apos;ensemble</h1>
          <p className="text-subtle text-sm mt-1">Stats globales de Wealth OS.</p>
        </div>
        <Link
          href="/admin/users"
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-[#0b1220] font-bold text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          <Users className="w-4 h-4" />
          Gérer les utilisateurs
          <ArrowRight className="w-4 h-4" />
        </Link>
      </header>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[13px]">{error}</div>
      )}

      {!stats && !error && <div className="text-faint text-sm">Chargement…</div>}

      {stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<Users className="w-3.5 h-3.5" />}
              label="Utilisateurs"
              value={String(stats.users.total)}
              sub={`${stats.users.verified} vérifiés · ${stats.users.suspended} suspendus`}
            />
            <StatCard
              icon={<Wallet className="w-3.5 h-3.5" />}
              label="Comptes"
              value={String(stats.accounts.total)}
              sub={fmtMAD(stats.accounts.totalBalance)}
            />
            <StatCard
              icon={<ArrowLeftRight className="w-3.5 h-3.5" />}
              label="Transactions"
              value={String(stats.transactions.total)}
            />
            <StatCard
              icon={<Repeat className="w-3.5 h-3.5" />}
              label="Abonnements"
              value={String(stats.subscriptions.total)}
              sub={`${stats.subscriptions.active} actifs`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-surface border border-line rounded-2xl p-5">
              <div className="flex items-center gap-2 text-subtle text-[11px] font-bold uppercase tracking-widest mb-3">
                <Target className="w-3.5 h-3.5" />
                Objectifs d&apos;épargne
              </div>
              <div className="flex items-end gap-6">
                <div>
                  <div className="text-2xl font-black">{stats.savingsGoals.total}</div>
                  <div className="text-[12px] text-faint">objectifs actifs</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-emerald-400">{fmtMAD(stats.savingsGoals.totalSaved)}</div>
                  <div className="text-[12px] text-faint">épargné sur {fmtMAD(stats.savingsGoals.totalTarget)}</div>
                </div>
              </div>
            </div>

            <div className="bg-surface border border-line rounded-2xl p-5">
              <div className="flex items-center gap-2 text-subtle text-[11px] font-bold uppercase tracking-widest mb-3">
                <ShieldAlert className="w-3.5 h-3.5" />
                Config système
              </div>
              <ConfigRow label="AUTH_SECRET" ok={stats.system.authSecretConfigured} />
              <ConfigRow label="ADMIN_AUTH_SECRET" ok={stats.system.adminAuthSecretConfigured} />
              <ConfigRow label="Email (RESEND_API_KEY)" ok={stats.system.emailConfigured} />
              <div className="flex items-center justify-between py-2">
                <span className="text-[13px] text-body-soft">Environnement</span>
                <span className="text-[12px] font-mono text-muted">{stats.system.nodeEnv}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
