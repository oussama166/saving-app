"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldBan,
  ShieldCheck,
  MailWarning,
  Trash2,
  Loader2,
  Wallet,
  ArrowLeftRight,
  Target,
  Repeat,
  Settings,
  Check,
  Pencil,
  KeyRound,
} from "lucide-react";

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
}
interface Transaction {
  id: string;
  merchant: string;
  amount: number;
  date: string;
  category: { name: string } | null;
  account: { name: string } | null;
}
interface SavingsGoal {
  id: string;
  name: string;
  goalType: string;
  beneficiary: string | null;
  targetAmount: number;
  currentAmount: number;
}
interface Subscription {
  id: string;
  name: string;
  price: number;
  billingDay: number;
  isActive: boolean;
}
interface UserDetail {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  isSuspended: boolean;
  suspendedAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
  settings: { referenceIncome: number; currency: string; emergencyFundTargetMonths: number } | null;
  accounts: Account[];
  transactions: Transaction[];
  savingsGoals: SavingsGoal[];
  subscriptions: Subscription[];
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 }).format(n);
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ referenceIncome: "", currency: "", emergencyFundTargetMonths: "" });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Non-async, setState uniquement dans les callbacks .then/.catch — évite
  // react-hooks/set-state-in-effect (voir même pattern dans users/page.tsx).
  const load = useCallback(() => {
    return fetch(`/api/admin/users/${id}`)
      .then((res) => res.json())
      .then((result) => {
        if (!result.success) {
          setError(result.error || "Erreur de chargement");
          return;
        }
        setUser(result.data);
      })
      .catch(() => setError("Erreur réseau"));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSuspendToggle = async () => {
    if (!user) return;
    setBusy(true);
    try {
      if (user.isSuspended) {
        await fetch(`/api/admin/users/${id}/reactivate`, { method: "POST" });
      } else {
        const reason = window.prompt("Raison de la suspension (optionnel) :") ?? "";
        await fetch(`/api/admin/users/${id}/suspend`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    setBusy(true);
    try {
      await fetch(`/api/admin/users/${id}/resend-verification`, { method: "POST" });
    } finally {
      setBusy(false);
    }
  };

  const [resetSent, setResetSent] = useState(false);
  const handleResetPassword = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/reset-password`, { method: "POST" });
      const result = await res.json();
      if (result.success) setResetSent(true);
    } finally {
      setBusy(false);
    }
  };

  const openSettingsEdit = () => {
    if (!user) return;
    setSettingsForm({
      referenceIncome: String(user.settings?.referenceIncome ?? 10000),
      currency: user.settings?.currency ?? "MAD",
      emergencyFundTargetMonths: String(user.settings?.emergencyFundTargetMonths ?? 3),
    });
    setSettingsError(null);
    setEditingSettings(true);
  };

  const handleSaveSettings = async () => {
    setSettingsError(null);
    const referenceIncome = Number(settingsForm.referenceIncome);
    const emergencyFundTargetMonths = Number(settingsForm.emergencyFundTargetMonths);
    if (!Number.isFinite(referenceIncome) || referenceIncome < 0) {
      setSettingsError("Revenu de référence invalide");
      return;
    }
    if (!Number.isFinite(emergencyFundTargetMonths) || emergencyFundTargetMonths < 0) {
      setSettingsError("Objectif fonds d'urgence invalide");
      return;
    }
    setSettingsSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceIncome, currency: settingsForm.currency, emergencyFundTargetMonths }),
      });
      const result = await res.json();
      if (!result.success) {
        setSettingsError(result.error || "Erreur lors de l'enregistrement");
        return;
      }
      setEditingSettings(false);
      await load();
    } catch {
      setSettingsError("Erreur réseau");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || deleteConfirm !== user.email) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        router.push("/admin/users");
      } else {
        setError(result.error || "Suppression échouée");
      }
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <main className="max-w-5xl mx-auto p-6 text-ink">
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[13px]">{error}</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-5xl mx-auto p-6 text-faint flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
      </main>
    );
  }

  const totalBalance = user.accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <main className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 text-ink">
      <Link href="/admin/users" className="flex items-center gap-1.5 text-subtle hover:text-ink text-[13px] w-fit">
        <ArrowLeft className="w-3.5 h-3.5" /> Retour aux utilisateurs
      </Link>

      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">{user.name || user.email}</h1>
          <p className="text-subtle text-sm mt-1">{user.email}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {user.isSuspended ? (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/25">
                Suspendu{user.suspendedReason ? ` — ${user.suspendedReason}` : ""}
              </span>
            ) : (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                Actif
              </span>
            )}
            {!user.emailVerified && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/25">
                Email non vérifié
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!user.emailVerified && (
            <button
              onClick={handleResendVerification}
              disabled={busy}
              className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-2 rounded-lg bg-surface border border-line text-body-soft hover:text-ink disabled:opacity-50"
            >
              <MailWarning className="w-3.5 h-3.5" /> Renvoyer vérification
            </button>
          )}
          <button
            onClick={handleResetPassword}
            disabled={busy || resetSent}
            className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-2 rounded-lg bg-surface border border-line text-body-soft hover:text-ink disabled:opacity-50"
          >
            <KeyRound className="w-3.5 h-3.5" /> {resetSent ? "Email envoyé" : "Réinitialiser mot de passe"}
          </button>
          <button
            onClick={handleSuspendToggle}
            disabled={busy}
            className={`flex items-center gap-1.5 text-[13px] font-semibold px-3 py-2 rounded-lg border disabled:opacity-50 ${
              user.isSuspended
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/20"
                : "bg-red-500/10 border-red-500/25 text-red-300 hover:bg-red-500/20"
            }`}
          >
            {user.isSuspended ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldBan className="w-3.5 h-3.5" />}
            {user.isSuspended ? "Réactiver" : "Suspendre"}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface border border-line rounded-2xl p-4">
          <div className="flex items-center gap-2 text-faint text-[11px] font-bold uppercase tracking-widest mb-1">
            <Wallet className="w-3.5 h-3.5" /> Solde total
          </div>
          <div className="text-xl font-black">{fmt(totalBalance)} MAD</div>
        </div>
        <div className="bg-surface border border-line rounded-2xl p-4">
          <div className="flex items-center gap-2 text-faint text-[11px] font-bold uppercase tracking-widest mb-1">
            <ArrowLeftRight className="w-3.5 h-3.5" /> Transactions
          </div>
          <div className="text-xl font-black">{user.transactions.length}{user.transactions.length === 50 ? "+" : ""}</div>
        </div>
        <div className="bg-surface border border-line rounded-2xl p-4">
          <div className="flex items-center gap-2 text-faint text-[11px] font-bold uppercase tracking-widest mb-1">
            <Target className="w-3.5 h-3.5" /> Objectifs
          </div>
          <div className="text-xl font-black">{user.savingsGoals.length}</div>
        </div>
        <div className="bg-surface border border-line rounded-2xl p-4">
          <div className="flex items-center gap-2 text-faint text-[11px] font-bold uppercase tracking-widest mb-1">
            <Repeat className="w-3.5 h-3.5" /> Abonnements
          </div>
          <div className="text-xl font-black">{user.subscriptions.filter((s) => s.isActive).length}</div>
        </div>
      </div>

      <section className="bg-surface border border-line rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-bold uppercase tracking-widest text-subtle flex items-center gap-2">
            <Settings className="w-3.5 h-3.5" /> Paramètres financiers
          </h2>
          {!editingSettings && (
            <button
              onClick={openSettingsEdit}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-muted hover:text-ink"
            >
              <Pencil className="w-3.5 h-3.5" /> Modifier
            </button>
          )}
        </div>
        {settingsError && (
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[12px] mb-3">{settingsError}</div>
        )}
        {editingSettings ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-faint">Revenu de référence</label>
                <input
                  type="number"
                  step="any"
                  value={settingsForm.referenceIncome}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, referenceIncome: e.target.value }))}
                  className="w-full bg-surface-alt border border-line text-ink rounded-lg p-2.5 text-sm focus:border-amber-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-faint">Devise</label>
                <input
                  type="text"
                  value={settingsForm.currency}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, currency: e.target.value }))}
                  className="w-full bg-surface-alt border border-line text-ink rounded-lg p-2.5 text-sm focus:border-amber-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-faint">Fonds d&apos;urgence (mois)</label>
                <input
                  type="number"
                  step="any"
                  value={settingsForm.emergencyFundTargetMonths}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, emergencyFundTargetMonths: e.target.value }))}
                  className="w-full bg-surface-alt border border-line text-ink rounded-lg p-2.5 text-sm focus:border-amber-500 outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveSettings}
                disabled={settingsSaving}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-[#0b1220] text-[12px] font-bold px-3 py-2 rounded-lg"
              >
                {settingsSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Enregistrer
              </button>
              <button
                onClick={() => setEditingSettings(false)}
                className="text-[12px] font-semibold text-subtle hover:text-ink px-3 py-2"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-faint text-[12px] block">Revenu de référence</span>
              <span className="font-semibold">{fmt(user.settings?.referenceIncome ?? 0)} {user.settings?.currency ?? "MAD"}</span>
            </div>
            <div>
              <span className="text-faint text-[12px] block">Devise</span>
              <span className="font-semibold">{user.settings?.currency ?? "MAD"}</span>
            </div>
            <div>
              <span className="text-faint text-[12px] block">Fonds d&apos;urgence</span>
              <span className="font-semibold">{user.settings?.emergencyFundTargetMonths ?? 0} mois</span>
            </div>
          </div>
        )}
      </section>

      <section className="bg-surface border border-line rounded-2xl p-5">
        <h2 className="text-[13px] font-bold uppercase tracking-widest text-subtle mb-3">Comptes</h2>
        {user.accounts.length === 0 ? (
          <p className="text-faint text-sm">Aucun compte.</p>
        ) : (
          <div className="space-y-2">
            {user.accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm py-1.5 border-b border-line-subtle last:border-0">
                <span>{a.name} <span className="text-faint text-[12px]">({a.type})</span></span>
                <span className="font-semibold">{fmt(a.balance)} MAD</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-surface border border-line rounded-2xl p-5">
        <h2 className="text-[13px] font-bold uppercase tracking-widest text-subtle mb-3">Transactions récentes</h2>
        {user.transactions.length === 0 ? (
          <p className="text-faint text-sm">Aucune transaction.</p>
        ) : (
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {user.transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-[13px] py-1.5 border-b border-line-subtle last:border-0">
                <div>
                  <span className="text-ink">{t.merchant}</span>
                  <span className="text-faint ml-2">{t.category?.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-faint">{new Date(t.date).toLocaleDateString("fr-FR")}</span>
                  <span className={`font-semibold ${t.amount < 0 ? "text-red-300" : "text-emerald-300"}`}>
                    {fmt(t.amount)} MAD
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-surface border border-line rounded-2xl p-5">
        <h2 className="text-[13px] font-bold uppercase tracking-widest text-subtle mb-3">Objectifs d&apos;épargne</h2>
        {user.savingsGoals.length === 0 ? (
          <p className="text-faint text-sm">Aucun objectif.</p>
        ) : (
          <div className="space-y-2">
            {user.savingsGoals.map((g) => (
              <div key={g.id} className="flex items-center justify-between text-sm py-1.5 border-b border-line-subtle last:border-0">
                <span>
                  {g.name} {g.beneficiary && <span className="text-faint text-[12px]">— {g.beneficiary}</span>}
                </span>
                <span className="font-semibold">{fmt(g.currentAmount)} / {fmt(g.targetAmount)} MAD</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-surface border border-line rounded-2xl p-5">
        <h2 className="text-[13px] font-bold uppercase tracking-widest text-subtle mb-3">Abonnements</h2>
        {user.subscriptions.length === 0 ? (
          <p className="text-faint text-sm">Aucun abonnement.</p>
        ) : (
          <div className="space-y-2">
            {user.subscriptions.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm py-1.5 border-b border-line-subtle last:border-0">
                <span>{s.name} {!s.isActive && <span className="text-faint text-[12px]">(inactif)</span>}</span>
                <span className="font-semibold">{fmt(s.price)} MAD · le {s.billingDay}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-red-500/[0.04] border border-red-500/20 rounded-2xl p-5 space-y-3">
        <h2 className="text-[13px] font-bold uppercase tracking-widest text-red-300">Zone de danger</h2>
        <p className="text-subtle text-[13px]">
          Supprime définitivement ce compte et toutes ses données financières. Irréversible. Tape l&apos;email du
          compte pour confirmer :
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={user.email}
            className="bg-surface-alt border border-line text-ink rounded-lg px-3 py-2 text-sm focus:border-red-500 outline-none flex-1 min-w-[220px]"
          />
          <button
            onClick={handleDelete}
            disabled={busy || deleteConfirm !== user.email}
            className="flex items-center gap-1.5 text-[13px] font-bold px-4 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Supprimer définitivement
          </button>
        </div>
      </section>
    </main>
  );
}
