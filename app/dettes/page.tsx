"use client";

import { useEffect, useState } from "react";
import {
  CreditCard,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Check,
  X,
  Wallet,
  History,
  Landmark,
  Home,
  HandCoins,
  HelpCircle,
} from "lucide-react";
import FeatureGate from "../components/FeatureGate";
import DebtStrategyComparison from "../components/DebtStrategyComparison";

interface DebtItem {
  id: string;
  name: string;
  type: string;
  lender: string | null;
  principal: number;
  currentBalance: number;
  interestRate: number;
  monthlyPayment: number;
  dueDay: number | null;
  isActive: boolean;
  paidOffPct: number;
  paymentCount: number;
}

interface PaymentItem {
  id: string;
  amount: number;
  date: string;
  note: string | null;
}

interface OptionItem {
  id: string;
  name: string;
}

const DEBT_TYPES: { value: string; label: string; icon: typeof Landmark }[] = [
  { value: "credit", label: "Crédit conso", icon: CreditCard },
  { value: "pret_immo", label: "Prêt immobilier", icon: Home },
  { value: "pret_perso", label: "Dette personnelle", icon: HandCoins },
  { value: "autre", label: "Autre", icon: HelpCircle },
];

function typeMeta(type: string) {
  return DEBT_TYPES.find((t) => t.value === type) ?? DEBT_TYPES[3];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

interface FormState {
  id: string | null;
  name: string;
  type: string;
  lender: string;
  principal: string;
  currentBalance: string;
  interestRate: string;
  monthlyPayment: string;
  dueDay: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  type: "autre",
  lender: "",
  principal: "",
  currentBalance: "",
  interestRate: "0",
  monthlyPayment: "0",
  dueDay: "",
};

export default function DettesPage() {
  return (
    <FeatureGate featureKey="debts" featureName="Dettes & Prêts">
      <DettesPageContent />
    </FeatureGate>
  );
}

function DettesPageContent() {
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [totalRemaining, setTotalRemaining] = useState(0);
  const [accounts, setAccounts] = useState<OptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [payFormId, setPayFormId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payLogTransaction, setPayLogTransaction] = useState(true);
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [historyCache, setHistoryCache] = useState<Record<string, PaymentItem[]>>({});
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);

  const load = () => {
    fetch("/api/debts")
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setDebts(result.data);
          setTotalRemaining(result.totalRemaining);
          setAccounts(result.accounts ?? []);
        }
      })
      .catch((err) => console.error("Debts fetch error:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openAddForm = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (debt: DebtItem) => {
    setForm({
      id: debt.id,
      name: debt.name,
      type: debt.type,
      lender: debt.lender ?? "",
      principal: String(debt.principal),
      currentBalance: String(debt.currentBalance),
      interestRate: String(debt.interestRate),
      monthlyPayment: String(debt.monthlyPayment),
      dueDay: debt.dueDay ? String(debt.dueDay) : "",
    });
    setFormError(null);
    setShowForm(true);
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
    const principalNum = Number(form.principal);
    if (!Number.isFinite(principalNum) || principalNum <= 0) {
      setFormError("Montant emprunté invalide");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        lender: form.lender || null,
        principal: principalNum,
        currentBalance: form.currentBalance !== "" ? Number(form.currentBalance) : principalNum,
        interestRate: Number(form.interestRate) || 0,
        monthlyPayment: Number(form.monthlyPayment) || 0,
        dueDay: form.dueDay || null,
      };

      const res = form.id
        ? await fetch(`/api/debts/${form.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/debts", {
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
      console.error("Debt save error:", err);
      setFormError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/debts/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        setConfirmDeleteId(null);
        load();
      }
    } catch (err) {
      console.error("Debt delete error:", err);
    } finally {
      setBusyId(null);
    }
  };

  const openPayForm = (debt: DebtItem) => {
    setPayFormId(debt.id);
    setPayAmount("");
    setPayLogTransaction(true);
    setPayError(null);
  };

  const submitPayment = async (debt: DebtItem) => {
    setPayError(null);
    const amountNum = Number(payAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setPayError("Montant invalide");
      return;
    }
    setPayBusy(true);
    try {
      const res = await fetch(`/api/debts/${debt.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNum, logTransaction: payLogTransaction }),
      });
      const result = await res.json();
      if (!result.success) {
        setPayError(result.error || "Erreur lors de l'enregistrement");
        return;
      }
      setPayFormId(null);
      setHistoryCache((prev) => {
        const rest = { ...prev };
        delete rest[debt.id];
        return rest;
      });
      load();
    } catch (err) {
      console.error("Debt payment error:", err);
      setPayError("Erreur réseau");
    } finally {
      setPayBusy(false);
    }
  };

  const toggleHistory = (debt: DebtItem) => {
    if (expandedHistoryId === debt.id) {
      setExpandedHistoryId(null);
      return;
    }
    setExpandedHistoryId(debt.id);
    if (historyCache[debt.id]) return;
    setHistoryLoadingId(debt.id);
    fetch(`/api/debts/${debt.id}/payments`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setHistoryCache((prev) => ({ ...prev, [debt.id]: result.data }));
        }
      })
      .catch((err) => console.error("Debt payments fetch error:", err))
      .finally(() => setHistoryLoadingId(null));
  };

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 font-sans bg-page text-body">
      <div className="mx-auto space-y-8 max-w-5xl">
        <div className="flex flex-col items-start justify-between gap-4 p-6 border bg-surface rounded-2xl border-line sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 border bg-orange-600/20 rounded-xl border-orange-500/20">
              <CreditCard className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight uppercase text-ink">Dettes & Prêts</h1>
              <p className="text-subtle text-sm mt-0.5">
                Crédits, prêts immobiliers, dettes personnelles — suivi du solde restant dû.
              </p>
            </div>
          </div>
          <button
            onClick={openAddForm}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Ajouter une dette
          </button>
        </div>

        <div className="p-6 border bg-surface rounded-2xl border-line">
          <div className="flex items-center gap-4">
            <div className="p-3 border bg-red-600/20 rounded-xl border-red-500/20">
              <Wallet className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-subtle text-xs uppercase tracking-widest font-bold">Total restant dû</p>
              <p className="text-2xl font-black text-ink">{totalRemaining.toFixed(2)} DH</p>
            </div>
          </div>
        </div>

        <DebtStrategyComparison debts={debts.filter((d) => d.isActive && d.currentBalance > 0)} />

        {showForm && (
          <div className="p-6 border bg-surface rounded-2xl border-line space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black tracking-tight uppercase text-ink">
                {form.id ? "Modifier la dette" : "Nouvelle dette"}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Nom</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Prêt immobilier"
                  className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
                >
                  {DEBT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                  Prêteur (optionnel)
                </label>
                <input
                  type="text"
                  value={form.lender}
                  onChange={(e) => setForm((f) => ({ ...f, lender: e.target.value }))}
                  placeholder="Attijariwafa Bank"
                  className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                  Échéance mensuelle (jour, optionnel)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={form.dueDay}
                  onChange={(e) => setForm((f) => ({ ...f, dueDay: e.target.value }))}
                  className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                  Montant emprunté (DH)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.principal}
                  onChange={(e) => setForm((f) => ({ ...f, principal: e.target.value }))}
                  placeholder="200000"
                  className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                  Solde restant dû (DH)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.currentBalance}
                  onChange={(e) => setForm((f) => ({ ...f, currentBalance: e.target.value }))}
                  placeholder={form.principal || "200000"}
                  className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
                />
                <p className="text-[10px] text-faint">Laisse vide pour reprendre le montant emprunté.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                  Taux d&apos;intérêt annuel (%)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.interestRate}
                  onChange={(e) => setForm((f) => ({ ...f, interestRate: e.target.value }))}
                  className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                  Mensualité indicative (DH)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.monthlyPayment}
                  onChange={(e) => setForm((f) => ({ ...f, monthlyPayment: e.target.value }))}
                  className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
                />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {form.id ? "Enregistrer" : "Ajouter"}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-12 h-12 border-b-2 border-orange-500 rounded-full animate-spin" />
          </div>
        ) : debts.length === 0 ? (
          <div className="p-10 text-center border bg-surface rounded-2xl border-line">
            <p className="text-subtle text-sm">Aucune dette enregistrée pour l&apos;instant.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {debts.map((debt) => {
              const meta = typeMeta(debt.type);
              const Icon = meta.icon;
              return (
                <div
                  key={debt.id}
                  className={`p-4 border bg-surface rounded-2xl border-line ${!debt.isActive ? "opacity-60" : ""}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="p-2.5 rounded-xl border bg-orange-600/10 border-orange-500/20 shrink-0">
                      <Icon className="w-5 h-5 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-ink text-sm">{debt.name}</p>
                        {!debt.isActive && (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                            Soldée
                          </span>
                        )}
                        {debt.paymentCount > 0 && (
                          <button
                            onClick={() => toggleHistory(debt)}
                            className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border transition-colors ${
                              expandedHistoryId === debt.id
                                ? "text-blue-400 bg-blue-500/20 border-blue-500/30"
                                : "text-blue-400 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20"
                            }`}
                          >
                            <History className="w-3 h-3" />
                            Historique ({debt.paymentCount})
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-subtle mt-0.5">
                        {meta.label}
                        {debt.lender ? ` · ${debt.lender}` : ""}
                        {debt.interestRate > 0 ? ` · ${debt.interestRate}%/an` : ""}
                      </p>
                      <div className="mt-2 max-w-xs">
                        <div className="h-1.5 rounded-full bg-surface-alt overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, debt.paidOffPct)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-faint mt-1">{debt.paidOffPct}% remboursé</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4">
                      <p className="font-black text-ink text-sm whitespace-nowrap">
                        {debt.currentBalance.toFixed(2)} DH
                      </p>
                      {debt.isActive && (
                        <button
                          onClick={() => openPayForm(debt)}
                          className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-emerald-500/20 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors whitespace-nowrap"
                        >
                          Rembourser
                        </button>
                      )}
                      <button
                        onClick={() => openEditForm(debt)}
                        className="p-2 border rounded-lg border-line text-body-soft hover:bg-surface-alt transition-colors"
                        aria-label="Modifier"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {confirmDeleteId === debt.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleDelete(debt.id)}
                            disabled={busyId === debt.id}
                            className="p-2 border rounded-lg border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                            aria-label="Confirmer la suppression"
                          >
                            {busyId === debt.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="p-2 border rounded-lg border-line text-body-soft hover:bg-surface-alt transition-colors"
                            aria-label="Annuler"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(debt.id)}
                          className="p-2 border rounded-lg border-line text-body-soft hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors"
                          aria-label="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {payFormId === debt.id && (
                    <div className="mt-3 pt-3 border-t border-line-subtle space-y-2">
                      {payError && (
                        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
                          {payError}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          placeholder="Montant remboursé (DH)"
                          className="flex-1 min-w-[140px] bg-page border border-line text-body rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm"
                        />
                        {accounts.length > 0 && (
                          <label className="flex items-center gap-1.5 text-[11px] text-body-soft whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={payLogTransaction}
                              onChange={(e) => setPayLogTransaction(e.target.checked)}
                            />
                            Débiter un compte
                          </label>
                        )}
                        <button
                          onClick={() => submitPayment(debt)}
                          disabled={payBusy}
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                        >
                          {payBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Confirmer
                        </button>
                        <button
                          onClick={() => setPayFormId(null)}
                          className="p-2 text-body-soft hover:text-ink rounded-lg hover:bg-surface-alt"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {expandedHistoryId === debt.id && (
                    <div className="mt-3 pt-3 border-t border-line-subtle space-y-1.5">
                      {historyLoadingId === debt.id && !historyCache[debt.id] ? (
                        <p className="text-[11px] text-faint flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" /> Chargement...
                        </p>
                      ) : (historyCache[debt.id]?.length ?? 0) === 0 ? (
                        <p className="text-[11px] text-faint">Aucun remboursement enregistré.</p>
                      ) : (
                        historyCache[debt.id].map((payment) => (
                          <p key={payment.id} className="text-[11px] text-subtle flex items-center gap-1.5 flex-wrap">
                            <span className="text-faint">{formatDate(payment.date)}</span>
                            <span>— {payment.amount.toFixed(2)} DH</span>
                            {payment.note && <span className="text-faint">({payment.note})</span>}
                          </p>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
