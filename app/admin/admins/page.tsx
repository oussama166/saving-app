"use client";

import { useEffect, useState, useCallback } from "react";
import { UserCog, PlusCircle, ShieldBan, ShieldCheck, Loader2, X } from "lucide-react";

interface AdminRow {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function AdminAdminsPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    return fetch("/api/admin/admins")
      .then((res) => res.json())
      .then((result) => {
        if (!result.success) {
          setError(result.error || "Erreur de chargement");
          return;
        }
        setError(null);
        setAdmins(result.data);
      })
      .catch(() => setError("Erreur réseau"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    fetch("/api/admin/me")
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setMe({ id: result.admin.id });
      })
      .catch(() => {});
  }, [load]);

  const activeCount = admins.filter((a) => a.isActive).length;

  const toggleActive = async (admin: AdminRow) => {
    setBusyId(admin.id);
    try {
      const res = await fetch(`/api/admin/admins/${admin.id}/toggle-active`, { method: "POST" });
      const result = await res.json();
      if (!result.success) {
        setError(result.error || "Action impossible");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password }),
      });
      const result = await res.json();
      if (!result.success) {
        setFormError(result.error || "Erreur lors de la création");
        return;
      }
      setShowForm(false);
      setEmail("");
      setName("");
      setPassword("");
      await load();
    } catch {
      setFormError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 text-ink">
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <UserCog className="w-6 h-6 text-amber-400" />
            Administrateurs
          </h1>
          <p className="text-subtle text-sm mt-1">{admins.length} compte{admins.length === 1 ? "" : "s"} admin · {activeCount} actif{activeCount === 1 ? "" : "s"}.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-[#0b1220] font-bold text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          {showForm ? <X className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
          {showForm ? "Annuler" : "Nouvel admin"}
        </button>
      </header>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[13px]">{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-surface border border-line rounded-2xl p-6 space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[13px]">{formError}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface-alt border border-line text-ink rounded-lg p-3 focus:border-amber-500 outline-none text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Nom (optionnel)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface-alt border border-line text-ink rounded-lg p-3 focus:border-amber-500 outline-none text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Mot de passe</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="12+ caractères, majuscule, minuscule, chiffre, caractère spécial"
              className="w-full bg-surface-alt border border-line text-ink rounded-lg p-3 focus:border-amber-500 outline-none text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-[#0b1220] font-bold text-sm px-4 py-2.5 rounded-lg transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Créer l&apos;admin
          </button>
        </form>
      )}

      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        {loading ? (
          <div className="px-4 py-10 text-center text-faint">
            <Loader2 className="w-5 h-5 animate-spin inline-block" />
          </div>
        ) : (
          <div className="divide-y divide-line-subtle">
            {admins.map((admin) => {
              const isSelf = me?.id === admin.id;
              const disableDeactivate = admin.isActive && (isSelf || activeCount <= 1);
              return (
                <div key={admin.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink text-sm">{admin.name || admin.email}</span>
                      {isSelf && <span className="text-[10px] font-bold uppercase text-amber-400/80">Toi</span>}
                      {admin.isActive ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                          Actif
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/25">
                          Désactivé
                        </span>
                      )}
                    </div>
                    {admin.name && <div className="text-[12px] text-faint">{admin.email}</div>}
                    <div className="text-[11px] text-faint mt-0.5">
                      Créé le {new Date(admin.createdAt).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleActive(admin)}
                    disabled={busyId === admin.id || disableDeactivate}
                    title={disableDeactivate ? "Impossible de désactiver (toi-même ou dernier admin actif)" : undefined}
                    className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                      admin.isActive ? "text-red-300 hover:bg-red-500/10" : "text-emerald-300 hover:bg-emerald-500/10"
                    }`}
                  >
                    {busyId === admin.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : admin.isActive ? (
                      <ShieldBan className="w-3.5 h-3.5" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    {admin.isActive ? "Désactiver" : "Réactiver"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
