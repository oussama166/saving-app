"use client";

import { useEffect, useState } from "react";
import {
  Repeat,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Check,
  X,
  Tv,
  Music2,
  Gamepad2,
  Cloud,
  Sparkles,
  CalendarClock,
  Wallet,
  History,
  BellRing,
} from "lucide-react";
import {
  SUBSCRIPTION_CATALOG,
  SUBSCRIPTION_ICON_STYLES,
  findCatalogEntry,
  type SubscriptionCatalogEntry,
} from "../../lib/subscriptionCatalog";
import FeatureGate from "../components/FeatureGate";
import SubscriptionAlerts from "../components/SubscriptionAlerts";

interface SubscriptionItem {
  id: string;
  name: string;
  provider: string | null;
  subCategory: string | null;
  price: number;
  billingDay: number;
  isActive: boolean;
  categoryId: string;
  categoryName: string;
  accountId: string;
  accountName: string;
  nextBillingDate: string | null;
  planChangeCount: number;
  transactionCount: number;
  createdAt: string;
  activeMonths: number;
}

interface UpcomingReminder {
  subscriptionId: string;
  name: string;
  price: number;
  nextBillingDate: string;
  daysUntil: number;
}

interface OptionItem {
  id: string;
  name: string;
}

interface PlanChangeItem {
  id: string;
  previousName: string;
  newName: string;
  previousPrice: number;
  newPrice: number;
  changedAt: string;
}

const ICONS: Record<SubscriptionCatalogEntry["icon"], typeof Tv> = {
  video: Tv,
  music: Music2,
  gamepad: Gamepad2,
  cloud: Cloud,
  sparkles: Sparkles,
};

function SubscriptionIcon({
  provider,
  className,
}: {
  provider: string | null;
  className?: string;
}) {
  const entry = findCatalogEntry(provider);
  const style = SUBSCRIPTION_ICON_STYLES[entry?.color ?? "neutral"];
  const Icon = entry ? ICONS[entry.icon] : Repeat;
  return (
    <div className={`p-2.5 rounded-xl border ${style.bg} ${style.border} shrink-0`}>
      <Icon className={`${style.text} ${className ?? "w-5 h-5"}`} />
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface FormState {
  id: string | null;
  provider: string | null;
  planLabel: string;
  name: string;
  subCategory: string;
  price: string;
  billingDay: string;
  categoryId: string;
  accountId: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  provider: null,
  planLabel: "",
  name: "",
  subCategory: "",
  price: "",
  billingDay: "1",
  categoryId: "",
  accountId: "",
};

export default function AbonnementsPage() {
  return (
    <FeatureGate featureKey="subscriptions" featureName="Abonnements">
      <AbonnementsPageContent />
    </FeatureGate>
  );
}

function AbonnementsPageContent() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [totalMonthly, setTotalMonthly] = useState(0);
  const [upcomingReminders, setUpcomingReminders] = useState<UpcomingReminder[]>([]);
  const [accounts, setAccounts] = useState<OptionItem[]>([]);
  const [categories, setCategories] = useState<OptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCatalog, setShowCatalog] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteAlsoTransactions, setDeleteAlsoTransactions] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [planHistoryCache, setPlanHistoryCache] = useState<Record<string, PlanChangeItem[]>>({});
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);

  const load = () => {
    fetch("/api/subscriptions")
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setSubscriptions(result.data.subscriptions);
          setTotalMonthly(result.data.totalMonthly);
          setAccounts(result.data.accounts);
          setCategories(result.data.categories);
          setUpcomingReminders(result.data.upcomingReminders ?? []);
        }
      })
      .catch((err) => console.error("Subscriptions fetch error:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  // Historique des changements de plan (Standard -> Premium, etc.) détectés
  // automatiquement par /api/webhook/subscription-payment — chargé à la
  // demande (pas dans le GET principal) et mis en cache par abonnement pour
  // éviter de refetch à chaque ouverture/fermeture du panneau.
  const toggleHistory = (sub: SubscriptionItem) => {
    if (expandedHistoryId === sub.id) {
      setExpandedHistoryId(null);
      return;
    }
    setExpandedHistoryId(sub.id);
    if (planHistoryCache[sub.id]) return;
    setHistoryLoadingId(sub.id);
    fetch(`/api/subscriptions/${sub.id}/plan-history`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setPlanHistoryCache((prev) => ({ ...prev, [sub.id]: result.data }));
        }
      })
      .catch((err) => console.error("Plan history fetch error:", err))
      .finally(() => setHistoryLoadingId(null));
  };

  const openAddForm = () => {
    const defaultCategory = categories.find((c) => c.name === "Tech & Abonnements") ?? categories[0];
    setForm({
      ...EMPTY_FORM,
      categoryId: defaultCategory?.id ?? "",
      accountId: accounts[0]?.id ?? "",
    });
    setShowCatalog(true);
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (sub: SubscriptionItem) => {
    setForm({
      id: sub.id,
      provider: sub.provider,
      planLabel: "",
      name: sub.name,
      subCategory: sub.subCategory ?? "",
      price: String(sub.price),
      billingDay: String(sub.billingDay),
      categoryId: sub.categoryId,
      accountId: sub.accountId,
    });
    setShowCatalog(false);
    setFormError(null);
    setShowForm(true);
  };

  const pickCatalogEntry = (entry: SubscriptionCatalogEntry) => {
    const singlePlan = entry.plans.length === 1 ? entry.plans[0] : null;
    setForm((f) => ({
      ...f,
      provider: entry.key,
      name: singlePlan ? entry.name : `${entry.name} (${entry.plans[0].label})`,
      subCategory: entry.suggestedSubCategory,
      price: String((singlePlan ?? entry.plans[0]).price),
      planLabel: singlePlan ? "" : entry.plans[0].label,
    }));
    setShowCatalog(false);
  };

  const pickPlan = (entry: SubscriptionCatalogEntry, planLabel: string) => {
    const plan = entry.plans.find((p) => p.label === planLabel);
    if (!plan) return;
    setForm((f) => ({
      ...f,
      planLabel: plan.label,
      price: String(plan.price),
      name: `${entry.name} (${plan.label})`,
    }));
  };

  const pickCustom = () => {
    setForm((f) => ({ ...f, provider: null, planLabel: "" }));
    setShowCatalog(false);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError("Nom requis");
      return;
    }
    const numericPrice = Number(form.price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setFormError("Prix invalide");
      return;
    }
    const numericBillingDay = Number(form.billingDay);
    if (!Number.isInteger(numericBillingDay) || numericBillingDay < 1 || numericBillingDay > 31) {
      setFormError("Jour de prélèvement invalide (1-31)");
      return;
    }
    if (!form.categoryId) {
      setFormError("Catégorie requise");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        provider: form.provider,
        subCategory: form.subCategory || null,
        price: numericPrice,
        billingDay: numericBillingDay,
        categoryId: form.categoryId,
        accountId: form.accountId || undefined,
      };

      const res = form.id
        ? await fetch(`/api/subscriptions/${form.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/subscriptions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const result = await res.json();
      if (!result.success) {
        setFormError(result.error || "Erreur lors de l'enregistrement");
        return;
      }
      closeForm();
      setLoading(true);
      load();
    } catch (err) {
      console.error("Subscription save error:", err);
      setFormError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (sub: SubscriptionItem) => {
    setBusyId(sub.id);
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !sub.isActive }),
      });
      const result = await res.json();
      if (result.success) load();
    } catch (err) {
      console.error("Subscription toggle error:", err);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string, deleteTransactions: boolean) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/subscriptions/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteTransactions }),
      });
      const result = await res.json();
      if (result.success) {
        setConfirmDeleteId(null);
        setDeleteAlsoTransactions(false);
        load();
      }
    } catch (err) {
      console.error("Subscription delete error:", err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 font-sans bg-page text-body">
      <div className="mx-auto space-y-8 max-w-5xl">
        <div className="flex flex-col items-start justify-between gap-4 p-6 border bg-surface rounded-2xl border-line sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 border bg-purple-600/20 rounded-xl border-purple-500/20">
              <Repeat className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight uppercase text-ink">
                Abonnements
              </h1>
              <p className="text-subtle text-sm mt-0.5">
                Netflix, Spotify, PSN Plus... suivi et prélèvement automatique chaque mois.
              </p>
            </div>
          </div>
          <button
            onClick={openAddForm}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Ajouter un abonnement
          </button>
        </div>

        <div className="p-6 border bg-surface rounded-2xl border-line">
          <div className="flex items-center gap-4">
            <div className="p-3 border bg-emerald-600/20 rounded-xl border-emerald-500/20">
              <Wallet className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-subtle text-xs uppercase tracking-widest font-bold">Total mensuel</p>
              <p className="text-2xl font-black text-ink">{totalMonthly.toFixed(2)} DH / mois</p>
            </div>
          </div>
        </div>

        {upcomingReminders.length > 0 && (
          <div className="p-5 border bg-amber-500/10 rounded-2xl border-amber-500/20 space-y-3">
            <div className="flex items-center gap-2.5">
              <BellRing className="w-4.5 h-4.5 text-amber-400 shrink-0" />
              <p className="text-[13px] font-bold text-amber-400">
                {upcomingReminders.length > 1
                  ? `${upcomingReminders.length} prélèvements arrivent bientôt`
                  : "Un prélèvement arrive bientôt"}
              </p>
            </div>
            <div className="space-y-1.5">
              {upcomingReminders.map((r) => (
                <p key={r.subscriptionId} className="text-[13px] text-body-soft pl-7">
                  <span className="font-bold text-ink">{r.name}</span> — {r.price.toFixed(2)} DH,{" "}
                  {r.daysUntil <= 1 ? "prélevé demain" : `prélevé dans ${r.daysUntil} jours`} (
                  {formatDate(r.nextBillingDate)})
                </p>
              ))}
            </div>
          </div>
        )}

        <SubscriptionAlerts subscriptions={subscriptions} />

        {showForm && (
          <div className="p-6 border bg-surface rounded-2xl border-line space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black tracking-tight uppercase text-ink">
                {form.id ? "Modifier l'abonnement" : "Nouvel abonnement"}
              </h2>
              <button onClick={closeForm} className="p-1.5 text-muted hover:text-ink rounded-lg hover:bg-surface-alt">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
                {formError}
              </div>
            )}

            {showCatalog ? (
              <div className="space-y-3">
                <p className="text-xs text-subtle">Choisis un service courant ou ajoute un abonnement personnalisé.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {SUBSCRIPTION_CATALOG.map((entry) => {
                    const style = SUBSCRIPTION_ICON_STYLES[entry.color];
                    const Icon = ICONS[entry.icon];
                    return (
                      <button
                        key={entry.key}
                        onClick={() => pickCatalogEntry(entry)}
                        className="flex flex-col items-center gap-2 p-3 border rounded-xl border-line hover:bg-surface-alt transition-colors text-center"
                      >
                        <div className={`p-2 rounded-lg border ${style.bg} ${style.border}`}>
                          <Icon className={`w-5 h-5 ${style.text}`} />
                        </div>
                        <span className="text-[11px] font-medium text-body-soft">{entry.name}</span>
                      </button>
                    );
                  })}
                  <button
                    onClick={pickCustom}
                    className="flex flex-col items-center justify-center gap-2 p-3 border border-dashed rounded-xl border-line hover:bg-surface-alt transition-colors text-center"
                  >
                    <div className="p-2 rounded-lg border bg-neutral-600/20 border-neutral-500/20">
                      <Plus className="w-5 h-5 text-neutral-400" />
                    </div>
                    <span className="text-[11px] font-medium text-body-soft">Personnalisé</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Nom</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Netflix"
                      className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                      Sous-catégorie (optionnel)
                    </label>
                    <input
                      type="text"
                      value={form.subCategory}
                      onChange={(e) => setForm((f) => ({ ...f, subCategory: e.target.value }))}
                      placeholder="Streaming Vidéo"
                      className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
                    />
                  </div>
                </div>

                {(() => {
                  const catalogEntry = findCatalogEntry(form.provider);
                  if (!catalogEntry || catalogEntry.plans.length <= 1) return null;
                  return (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                        Formule / Plan existant
                      </label>
                      <select
                        value={form.planLabel}
                        onChange={(e) => pickPlan(catalogEntry, e.target.value)}
                        className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
                      >
                        {catalogEntry.plans.map((plan) => (
                          <option key={plan.label} value={plan.label}>
                            {plan.label} — {plan.price.toFixed(2)} DH/mois
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Prix (DH)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price}
                      onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                      placeholder="79.00"
                      className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
                    />
                    {!form.id && form.provider && (
                      <p className="text-[10px] text-faint">
                        Prix suggéré pour ce service — ajuste selon ton plan/offre réel.
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                      Jour de prélèvement
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={form.billingDay}
                      onChange={(e) => setForm((f) => ({ ...f, billingDay: e.target.value }))}
                      className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Catégorie</label>
                    <select
                      value={form.categoryId}
                      onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                      className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {accounts.length > 1 && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Compte</label>
                      <select
                        value={form.accountId}
                        onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
                        className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {form.id ? "Enregistrer" : "Ajouter"}
                  </button>
                  {!form.id && (
                    <button
                      onClick={() => setShowCatalog(true)}
                      className="px-4 py-2.5 text-sm font-medium border rounded-xl border-line text-body-soft hover:bg-surface-alt transition-colors"
                    >
                      Retour au catalogue
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-12 h-12 border-b-2 border-purple-500 rounded-full animate-spin" />
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="p-10 text-center border bg-surface rounded-2xl border-line">
            <p className="text-subtle text-sm">Aucun abonnement enregistré pour l&apos;instant.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {subscriptions.map((sub) => (
              <div
                key={sub.id}
                className={`p-4 border bg-surface rounded-2xl border-line ${!sub.isActive ? "opacity-50" : ""}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <SubscriptionIcon provider={sub.provider} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-ink text-sm">{sub.name}</p>
                      {!sub.isActive && (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-muted bg-surface-alt px-1.5 py-0.5 rounded">
                          Suspendu
                        </span>
                      )}
                      {sub.planChangeCount > 0 && (
                        <button
                          onClick={() => toggleHistory(sub)}
                          className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border transition-colors ${
                            expandedHistoryId === sub.id
                              ? "text-blue-400 bg-blue-500/20 border-blue-500/30"
                              : "text-blue-400 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20"
                          }`}
                        >
                          <History className="w-3 h-3" />
                          Historique ({sub.planChangeCount})
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-subtle mt-0.5">
                      {sub.categoryName}
                      {sub.subCategory ? ` · ${sub.subCategory}` : ""}
                    </p>
                    {sub.isActive && sub.nextBillingDate && (
                      <p className="text-[11px] text-faint mt-1 flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" />
                        Prochain prélèvement : {formatDate(sub.nextBillingDate)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <p className="font-black text-ink text-sm whitespace-nowrap">{sub.price.toFixed(2)} DH</p>
                    <button
                      onClick={() => handleToggleActive(sub)}
                      disabled={busyId === sub.id}
                      className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg border transition-colors whitespace-nowrap disabled:opacity-50 ${
                        sub.isActive
                          ? "border-line text-body-soft hover:bg-surface-alt"
                          : "border-emerald-500/20 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                      }`}
                    >
                      {sub.isActive ? "Suspendre" : "Réactiver"}
                    </button>
                    <button
                      onClick={() => openEditForm(sub)}
                      className="p-2 border rounded-lg border-line text-body-soft hover:bg-surface-alt transition-colors"
                      aria-label="Modifier"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {confirmDeleteId === sub.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleDelete(sub.id, deleteAlsoTransactions)}
                          disabled={busyId === sub.id}
                          className="p-2 border rounded-lg border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          aria-label="Confirmer la suppression"
                        >
                          {busyId === sub.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setConfirmDeleteId(null);
                            setDeleteAlsoTransactions(false);
                          }}
                          className="p-2 border rounded-lg border-line text-body-soft hover:bg-surface-alt transition-colors"
                          aria-label="Annuler"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(sub.id)}
                        className="p-2 border rounded-lg border-line text-body-soft hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {confirmDeleteId === sub.id && sub.transactionCount > 0 && (
                  <div className="mt-3 pt-3 border-t border-line-subtle">
                    <label className="flex items-start gap-2 text-[11px] text-body-soft cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deleteAlsoTransactions}
                        onChange={(e) => setDeleteAlsoTransactions(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        Supprimer aussi {sub.transactionCount > 1 ? `les ${sub.transactionCount} dépenses` : "la dépense"} déjà
                        enregistrée{sub.transactionCount > 1 ? "s" : ""} pour cet abonnement (le solde du compte sera rétabli).
                        Sinon, l&apos;historique reste dans tes dépenses.
                      </span>
                    </label>
                  </div>
                )}

                {expandedHistoryId === sub.id && (
                  <div className="mt-3 pt-3 border-t border-line-subtle space-y-1.5">
                    {historyLoadingId === sub.id && !planHistoryCache[sub.id] ? (
                      <p className="text-[11px] text-faint flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin" /> Chargement...
                      </p>
                    ) : (planHistoryCache[sub.id]?.length ?? 0) === 0 ? (
                      <p className="text-[11px] text-faint">Aucun changement enregistré.</p>
                    ) : (
                      planHistoryCache[sub.id].map((change) => (
                        <p key={change.id} className="text-[11px] text-subtle flex items-center gap-1.5 flex-wrap">
                          <span className="text-faint">{formatDate(change.changedAt)}</span>
                          <span>
                            {change.previousName} ({change.previousPrice.toFixed(2)} DH) → {change.newName} (
                            {change.newPrice.toFixed(2)} DH)
                          </span>
                        </p>
                      ))
                    )}
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
