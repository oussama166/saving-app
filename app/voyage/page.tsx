"use client";

import { useEffect, useState } from "react";
import {
  Plane,
  Plus,
  Loader2,
  Check,
  X,
  Trash2,
  Archive,
  ArchiveRestore,
  Receipt,
} from "lucide-react";
import FeatureGate from "../components/FeatureGate";

interface ExpenseItem {
  id: string;
  merchant: string;
  amount: number;
  date: string;
  note: string | null;
}

interface TravelBudgetItem {
  id: string;
  name: string;
  currency: string;
  budgetAmount: number;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  spent: number;
  remaining: number;
  expenseCount: number;
  expenses: ExpenseItem[];
}

interface FormState {
  name: string;
  currency: string;
  budgetAmount: string;
  startDate: string;
  endDate: string;
}

const EMPTY_FORM: FormState = { name: "", currency: "EUR", budgetAmount: "", startDate: "", endDate: "" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function VoyagePage() {
  return (
    <FeatureGate featureKey="travel_budget" featureName="Budget Voyage">
      <VoyagePageContent />
    </FeatureGate>
  );
}

function VoyagePageContent() {
  const [budgets, setBudgets] = useState<TravelBudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [expenseFormId, setExpenseFormId] = useState<string | null>(null);
  const [expenseMerchant, setExpenseMerchant] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseBusy, setExpenseBusy] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  const load = () => {
    fetch("/api/travel-budgets")
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setBudgets(result.data);
      })
      .catch((err) => console.error("Travel budgets fetch error:", err))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const formatCUR = (val: number, currency: string) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format(val);

  const openAddForm = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError("Nom requis");
      return;
    }
    const amountNum = Number(form.budgetAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setFormError("Montant invalide");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/travel-budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          currency: form.currency.trim() || "EUR",
          budgetAmount: amountNum,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
        }),
      });
      const result = await res.json();
      if (!result.success) {
        setFormError(result.error || "Erreur lors de l'enregistrement");
        return;
      }
      setShowForm(false);
      load();
    } catch (err) {
      console.error("Travel budget save error:", err);
      setFormError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (budget: TravelBudgetItem) => {
    setBusyId(budget.id);
    try {
      await fetch(`/api/travel-budgets/${budget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !budget.isActive }),
      });
      load();
    } catch (err) {
      console.error("Travel budget toggle error:", err);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/travel-budgets/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        setConfirmDeleteId(null);
        load();
      }
    } catch (err) {
      console.error("Travel budget delete error:", err);
    } finally {
      setBusyId(null);
    }
  };

  const openExpenseForm = (budget: TravelBudgetItem) => {
    setExpenseFormId(budget.id);
    setExpenseMerchant("");
    setExpenseAmount("");
    setExpenseError(null);
  };

  const submitExpense = async (budget: TravelBudgetItem) => {
    setExpenseError(null);
    const amountNum = Number(expenseAmount);
    if (!expenseMerchant.trim()) {
      setExpenseError("Description requise");
      return;
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setExpenseError("Montant invalide");
      return;
    }
    setExpenseBusy(true);
    try {
      const res = await fetch(`/api/travel-budgets/${budget.id}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchant: expenseMerchant.trim(), amount: amountNum }),
      });
      const result = await res.json();
      if (!result.success) {
        setExpenseError(result.error || "Erreur lors de l'enregistrement");
        return;
      }
      setExpenseFormId(null);
      load();
    } catch (err) {
      console.error("Travel expense save error:", err);
      setExpenseError("Erreur réseau");
    } finally {
      setExpenseBusy(false);
    }
  };

  const removeExpense = async (budget: TravelBudgetItem, expenseId: string) => {
    setBusyId(expenseId);
    try {
      await fetch(`/api/travel-budgets/${budget.id}/expenses/${expenseId}`, { method: "DELETE" });
      load();
    } catch (err) {
      console.error("Travel expense delete error:", err);
    } finally {
      setBusyId(null);
    }
  };

  const visibleBudgets = budgets.filter((b) => (showArchived ? true : b.isActive));

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 font-sans bg-page text-body">
      <div className="mx-auto space-y-8 max-w-5xl">
        <div className="flex flex-col items-start justify-between gap-4 p-6 border bg-surface rounded-2xl border-line sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 border bg-sky-600/20 rounded-xl border-sky-500/20">
              <Plane className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight uppercase text-ink">Budget Voyage</h1>
              <p className="text-subtle text-sm mt-0.5">
                Une enveloppe temporaire dans une devise étrangère pour un séjour — distincte de tes comptes
                permanents.
              </p>
            </div>
          </div>
          <button
            onClick={openAddForm}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Nouveau budget voyage
          </button>
        </div>

        {showForm && (
          <div className="p-6 border bg-surface rounded-2xl border-line space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black tracking-tight uppercase text-ink">Nouveau budget voyage</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-muted hover:text-ink rounded-lg hover:bg-surface-alt">
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
                  placeholder="Voyage à Paris"
                  className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-sky-500 outline-none transition-colors text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Devise</label>
                <input
                  type="text"
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
                  placeholder="EUR"
                  maxLength={3}
                  className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-sky-500 outline-none transition-colors text-sm uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Montant alloué</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.budgetAmount}
                  onChange={(e) => setForm((f) => ({ ...f, budgetAmount: e.target.value }))}
                  placeholder="800"
                  className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-sky-500 outline-none transition-colors text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Départ (optionnel)</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-sky-500 outline-none transition-colors text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Retour (optionnel)</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-sky-500 outline-none transition-colors text-sm"
                />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Créer
            </button>
          </div>
        )}

        {budgets.some((b) => !b.isActive) && (
          <label className="flex items-center gap-2 text-xs text-subtle">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Afficher les budgets clôturés
          </label>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-12 h-12 border-b-2 border-sky-500 rounded-full animate-spin" />
          </div>
        ) : visibleBudgets.length === 0 ? (
          <div className="p-10 text-center border bg-surface rounded-2xl border-line">
            <p className="text-subtle text-sm">Aucun budget voyage pour l&apos;instant.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleBudgets.map((budget) => {
              const pct = budget.budgetAmount > 0 ? Math.min(100, Math.round((budget.spent / budget.budgetAmount) * 100)) : 0;
              const overBudget = budget.remaining < 0;
              return (
                <div
                  key={budget.id}
                  className={`p-5 border bg-surface rounded-2xl border-line space-y-4 ${!budget.isActive ? "opacity-60" : ""}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="p-2.5 rounded-xl border bg-sky-600/10 border-sky-500/20 shrink-0">
                      <Plane className="w-5 h-5 text-sky-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-ink text-sm">{budget.name}</p>
                        {!budget.isActive && (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-subtle bg-surface-alt border border-line px-1.5 py-0.5 rounded">
                            Clôturé
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-subtle mt-0.5">
                        {budget.currency}
                        {budget.startDate && ` · du ${formatDate(budget.startDate)}`}
                        {budget.endDate && ` au ${formatDate(budget.endDate)}`}
                        {` · ${budget.expenseCount} dépense${budget.expenseCount > 1 ? "s" : ""}`}
                      </p>
                      <div className="mt-2 max-w-xs">
                        <div className="h-1.5 rounded-full bg-surface-alt overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${overBudget ? "bg-red-500" : "bg-sky-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className={`text-[10px] mt-1 ${overBudget ? "text-red-400 font-bold" : "text-faint"}`}>
                          {formatCUR(budget.spent, budget.currency)} / {formatCUR(budget.budgetAmount, budget.currency)}
                          {overBudget && ` — dépassé de ${formatCUR(Math.abs(budget.remaining), budget.currency)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {budget.isActive && (
                        <button
                          onClick={() => openExpenseForm(budget)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-sky-500/20 text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 transition-colors whitespace-nowrap"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          Dépense
                        </button>
                      )}
                      <button
                        onClick={() => toggleActive(budget)}
                        disabled={busyId === budget.id}
                        className="p-2 border rounded-lg border-line text-body-soft hover:bg-surface-alt transition-colors disabled:opacity-50"
                        aria-label={budget.isActive ? "Clôturer" : "Réactiver"}
                        title={budget.isActive ? "Clôturer ce voyage" : "Réactiver"}
                      >
                        {budget.isActive ? <Archive className="w-3.5 h-3.5" /> : <ArchiveRestore className="w-3.5 h-3.5" />}
                      </button>
                      {confirmDeleteId === budget.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleDelete(budget.id)}
                            disabled={busyId === budget.id}
                            className="p-2 border rounded-lg border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          >
                            {busyId === budget.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="p-2 border rounded-lg border-line text-body-soft hover:bg-surface-alt transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(budget.id)}
                          className="p-2 border rounded-lg border-line text-body-soft hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors"
                          aria-label="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {expenseFormId === budget.id && (
                    <div className="pt-3 border-t border-line-subtle space-y-2">
                      {expenseError && (
                        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
                          {expenseError}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={expenseMerchant}
                          onChange={(e) => setExpenseMerchant(e.target.value)}
                          placeholder="Restaurant, hôtel..."
                          className="flex-1 min-w-[140px] bg-page border border-line text-body rounded-lg p-2.5 focus:border-sky-500 outline-none transition-colors text-sm"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={expenseAmount}
                          onChange={(e) => setExpenseAmount(e.target.value)}
                          placeholder={`Montant (${budget.currency})`}
                          className="w-40 bg-page border border-line text-body rounded-lg p-2.5 focus:border-sky-500 outline-none transition-colors text-sm"
                        />
                        <button
                          onClick={() => submitExpense(budget)}
                          disabled={expenseBusy}
                          className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                        >
                          {expenseBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Ajouter
                        </button>
                        <button
                          onClick={() => setExpenseFormId(null)}
                          className="p-2 text-body-soft hover:text-ink rounded-lg hover:bg-surface-alt"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {budget.expenses.length > 0 && (
                    <div className="pt-3 border-t border-line-subtle space-y-1.5">
                      {budget.expenses.slice(0, 8).map((e) => (
                        <div key={e.id} className="flex items-center justify-between gap-2 text-[12px]">
                          <span className="text-subtle truncate">
                            <span className="text-faint">{formatDate(e.date)}</span> — {e.merchant}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-body-soft font-mono">{formatCUR(e.amount, budget.currency)}</span>
                            {budget.isActive && (
                              <button
                                onClick={() => removeExpense(budget, e.id)}
                                disabled={busyId === e.id}
                                className="text-faint hover:text-red-400 transition-colors disabled:opacity-50"
                                aria-label="Supprimer la dépense"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
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
