"use client";

import { useEffect, useState, useCallback } from "react";
import { ToggleLeft, ToggleRight, Loader2, ChevronDown, ChevronUp, UserPlus, X, ShieldQuestion, MessageSquareText, Check } from "lucide-react";

interface FeatureRow {
  key: string;
  name: string;
  description: string;
  parentKey: string | null;
  enabled: boolean;
  customMessage: string | null;
  accessGrantCount: number;
}

interface AccessGrant {
  userId: string;
  email: string;
  name: string | null;
  grantedAt: string;
}

export default function AdminFeaturesPage() {
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const load = useCallback(() => {
    return fetch("/api/admin/features")
      .then((res) => res.json())
      .then((result) => {
        if (!result.success) {
          setError(result.error || "Erreur de chargement");
          return;
        }
        setError(null);
        setFeatures(result.data);
      })
      .catch(() => setError("Erreur réseau"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleEnabled = async (feature: FeatureRow) => {
    setBusyKey(feature.key);
    try {
      const res = await fetch(`/api/admin/features/${feature.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !feature.enabled }),
      });
      const result = await res.json();
      if (!result.success) {
        setError(result.error || "Action impossible");
        return;
      }
      await load();
    } finally {
      setBusyKey(null);
    }
  };

  const saveMessage = async (key: string, customMessage: string) => {
    const res = await fetch(`/api/admin/features/${key}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customMessage }),
    });
    const result = await res.json();
    if (!result.success) {
      setError(result.error || "Action impossible");
      return;
    }
    setFeatures((prev) => prev.map((f) => (f.key === key ? { ...f, customMessage: result.data.customMessage } : f)));
  };

  const topLevel = features.filter((f) => !f.parentKey);
  const childrenByParent = new Map<string, FeatureRow[]>();
  for (const f of features) {
    if (f.parentKey) {
      const list = childrenByParent.get(f.parentKey) ?? [];
      list.push(f);
      childrenByParent.set(f.parentKey, list);
    }
  }

  return (
    <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 text-ink">
      <header>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
          <ShieldQuestion className="w-6 h-6 text-amber-400" />
          Fonctionnalités
        </h1>
        <p className="text-subtle text-sm mt-1">
          Active/désactive chaque section de l&apos;app, ou une sous-fonctionnalité précise (ex: dans Profil &amp;
          Réglages). Une fonctionnalité désactivée affiche un message aux utilisateurs concernés — sauf ceux à qui tu
          as accordé une exception.
        </p>
      </header>

      {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[13px]">{error}</div>}

      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        {loading ? (
          <div className="px-4 py-10 text-center text-faint">
            <Loader2 className="w-5 h-5 animate-spin inline-block" />
          </div>
        ) : (
          <div className="divide-y divide-line-subtle">
            {topLevel.map((feature) => (
              <div key={feature.key}>
                <FeatureRowItem
                  feature={feature}
                  busy={busyKey === feature.key}
                  expanded={expandedKey === feature.key}
                  onToggleEnabled={() => toggleEnabled(feature)}
                  onToggleExpanded={() => setExpandedKey((k) => (k === feature.key ? null : feature.key))}
                  onSaveMessage={(msg) => saveMessage(feature.key, msg)}
                  onAccessCountChange={(count) =>
                    setFeatures((prev) => prev.map((f) => (f.key === feature.key ? { ...f, accessGrantCount: count } : f)))
                  }
                />
                {(childrenByParent.get(feature.key) ?? []).length > 0 && (
                  <div className="bg-surface-alt/30 divide-y divide-line-subtle border-t border-line-subtle">
                    {childrenByParent.get(feature.key)!.map((child) => (
                      <div key={child.key} className="pl-6">
                        <FeatureRowItem
                          feature={child}
                          busy={busyKey === child.key}
                          expanded={expandedKey === child.key}
                          onToggleEnabled={() => toggleEnabled(child)}
                          onToggleExpanded={() => setExpandedKey((k) => (k === child.key ? null : child.key))}
                          onSaveMessage={(msg) => saveMessage(child.key, msg)}
                          onAccessCountChange={(count) =>
                            setFeatures((prev) => prev.map((f) => (f.key === child.key ? { ...f, accessGrantCount: count } : f)))
                          }
                          compact
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function FeatureRowItem({
  feature,
  busy,
  expanded,
  onToggleEnabled,
  onToggleExpanded,
  onSaveMessage,
  onAccessCountChange,
  compact,
}: {
  feature: FeatureRow;
  busy: boolean;
  expanded: boolean;
  onToggleEnabled: () => void;
  onToggleExpanded: () => void;
  onSaveMessage: (message: string) => Promise<void>;
  onAccessCountChange: (count: number) => void;
  compact?: boolean;
}) {
  return (
    <div>
      <div className={`px-4 flex items-center justify-between gap-3 flex-wrap ${compact ? "py-2.5" : "py-3"}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-semibold text-ink ${compact ? "text-[13px]" : "text-sm"}`}>{feature.name}</span>
            {feature.enabled ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                Activé
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/25">
                Désactivé
              </span>
            )}
          </div>
          <div className="text-[11px] text-faint mt-0.5">{feature.description}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onToggleExpanded}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg text-body-soft hover:bg-surface-alt transition-colors"
          >
            {feature.accessGrantCount > 0 ? `${feature.accessGrantCount} exception${feature.accessGrantCount > 1 ? "s" : ""}` : "Détails"}
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onToggleEnabled}
            disabled={busy}
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-30 ${
              feature.enabled ? "text-red-300 hover:bg-red-500/10" : "text-emerald-300 hover:bg-emerald-500/10"
            }`}
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : feature.enabled ? (
              <ToggleRight className="w-3.5 h-3.5" />
            ) : (
              <ToggleLeft className="w-3.5 h-3.5" />
            )}
            {feature.enabled ? "Désactiver" : "Activer"}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <CustomMessageEditor initialMessage={feature.customMessage} onSave={onSaveMessage} />
          <FeatureAccessPanel featureKey={feature.key} onCountChange={onAccessCountChange} />
        </div>
      )}
    </div>
  );
}

function CustomMessageEditor({
  initialMessage,
  onSave,
}: {
  initialMessage: string | null;
  onSave: (message: string) => Promise<void>;
}) {
  const [message, setMessage] = useState(initialMessage ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await onSave(message);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface-alt/50 border border-line-subtle rounded-xl p-3 space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-widest text-subtle flex items-center gap-1.5">
        <MessageSquareText className="w-3.5 h-3.5" />
        Message affiché quand désactivé
      </p>
      <textarea
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          setSaved(false);
        }}
        placeholder="Vide = message générique par défaut"
        rows={2}
        className="w-full bg-page border border-line text-body rounded-lg p-2 text-[13px] outline-none focus:border-amber-500 resize-none"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 px-2.5 py-1.5 rounded-lg transition-colors"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
        {saved ? "Enregistré" : "Enregistrer le message"}
      </button>
    </div>
  );
}

function FeatureAccessPanel({ featureKey, onCountChange }: { featureKey: string; onCountChange: (count: number) => void }) {
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const load = useCallback(() => {
    return fetch(`/api/admin/features/${featureKey}/access`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setGrants(result.data);
          onCountChange(result.data.length);
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureKey]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setAdding(true);
    try {
      const res = await fetch(`/api/admin/features/${featureKey}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await res.json();
      if (!result.success) {
        setFormError(result.error || "Erreur");
        return;
      }
      setEmail("");
      await load();
    } catch {
      setFormError("Erreur réseau");
    } finally {
      setAdding(false);
    }
  };

  const handleRevoke = async (userId: string) => {
    setBusyUserId(userId);
    try {
      await fetch(`/api/admin/features/${featureKey}/access/${userId}`, { method: "DELETE" });
      await load();
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="bg-surface-alt/50 border border-line-subtle rounded-xl p-3 space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-widest text-subtle">
        Accès garanti même si désactivé globalement
      </p>

      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted" />
      ) : grants.length === 0 ? (
        <p className="text-[12px] text-faint">Aucune exception pour l&apos;instant.</p>
      ) : (
        <ul className="space-y-1.5">
          {grants.map((g) => (
            <li key={g.userId} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="text-body-soft truncate">{g.name || g.email}</span>
              <button
                onClick={() => handleRevoke(g.userId)}
                disabled={busyUserId === g.userId}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-300 hover:bg-red-500/10 px-2 py-1 rounded-md disabled:opacity-30 shrink-0"
              >
                {busyUserId === g.userId ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                Révoquer
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@exemple.com"
          className="flex-1 bg-page border border-line text-body rounded-lg p-2 text-[13px] outline-none focus:border-amber-500"
        />
        <button
          type="submit"
          disabled={adding}
          className="inline-flex items-center gap-1.5 text-[12px] font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-[#0b1220] px-3 py-2 rounded-lg transition-colors shrink-0"
        >
          {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
          Ajouter
        </button>
      </form>
      {formError && <p className="text-[12px] text-red-300">{formError}</p>}
    </div>
  );
}
