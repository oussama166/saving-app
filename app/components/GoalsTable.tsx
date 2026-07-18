'use client';

import { useEffect, useState } from 'react';
import {
  Target,
  Pencil,
  Trash2,
  Check,
  X,
  PlusCircle,
  Loader2,
  History,
  Wallet,
  CalendarClock,
  Heart,
  ShieldAlert,
  Briefcase,
  User as UserIcon,
  Sparkles,
} from 'lucide-react';
import { GOAL_TEMPLATES, findGoalTemplate } from '@/lib/goalTemplates';

export interface Goal {
  id: string;
  name: string;
  emoji: string | null;
  goalType: string;
  beneficiary: string | null;
  note: string | null;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  autoAllocatePct: number;
  targetDate: string | null;
  accountId: string | null;
  categoryId: string | null;
  autoContribute: boolean;
  contributionDay: number;
  lastContributedYearMonth: string | null;
}

interface OptionItem {
  id: string;
  name: string;
  type?: string;
}

interface Contribution {
  id: string;
  amount: number;
  date: string;
  note: string | null;
  isAutomatic: boolean;
}

const GOAL_TYPES: { value: string; label: string; color: string; icon: typeof UserIcon }[] = [
  { value: 'personnel', label: 'Personnel', color: 'blue', icon: UserIcon },
  { value: 'famille', label: 'Famille & Entraide', color: 'pink', icon: Heart },
  { value: 'urgence', label: 'Urgence', color: 'red', icon: ShieldAlert },
  { value: 'projet', label: 'Projet', color: 'purple', icon: Briefcase },
];

const TYPE_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: 'bg-blue-600/20', border: 'border-blue-500/20', text: 'text-blue-400' },
  pink: { bg: 'bg-pink-600/20', border: 'border-pink-500/20', text: 'text-pink-400' },
  red: { bg: 'bg-red-600/20', border: 'border-red-500/20', text: 'text-red-400' },
  purple: { bg: 'bg-purple-600/20', border: 'border-purple-500/20', text: 'text-purple-400' },
};

function goalTypeInfo(goalType: string) {
  return GOAL_TYPES.find((t) => t.value === goalType) ?? GOAL_TYPES[0];
}

function formatDH(amt: number) {
  return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amt).replace('MAD', 'DH');
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function monthsUntil(targetDate: string): number {
  const now = new Date();
  const target = new Date(targetDate);
  const months =
    (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()) - (now.getDate() > target.getDate() ? 1 : 0);
  return Math.max(months, 0);
}

function getStatus(progressPct: number) {
  if (progressPct >= 50) return { label: 'BIEN PARTI', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  if (progressPct >= 20) return { label: 'ENCORE UN EFFORT', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' };
  return { label: 'DÉMARRER VITE', color: 'text-red-400 bg-red-500/10 border-red-500/20' };
}

interface FormState {
  id: string | null;
  emoji: string;
  name: string;
  goalType: string;
  beneficiary: string;
  note: string;
  targetAmount: string;
  currentAmount: string;
  monthlyContribution: string;
  targetDate: string;
  accountId: string;
  categoryId: string;
  autoContribute: boolean;
  contributionDay: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  emoji: '🎯',
  name: '',
  goalType: 'personnel',
  beneficiary: '',
  note: '',
  targetAmount: '',
  currentAmount: '',
  monthlyContribution: '',
  targetDate: '',
  accountId: '',
  categoryId: '',
  autoContribute: false,
  contributionDay: '1',
};

export default function GoalsTable() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<OptionItem[]>([]);
  const [categories, setCategories] = useState<OptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [contributingGoalId, setContributingGoalId] = useState<string | null>(null);
  const [contribAmount, setContribAmount] = useState('');
  const [contribNote, setContribNote] = useState('');
  const [contribSaving, setContribSaving] = useState(false);

  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, Contribution[]>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);

  const load = () => {
    fetch('/api/goals')
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setGoals(result.data);
          setAccounts(result.accounts ?? []);
          setCategories(result.categories ?? []);
        }
      })
      .catch((err) => console.error('Goals fetch error:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const totalTarget = goals.reduce((acc, g) => acc + g.targetAmount, 0);
  const totalSaved = goals.reduce((acc, g) => acc + g.currentAmount, 0);
  const totalsByType = GOAL_TYPES.map((t) => ({
    ...t,
    target: goals.filter((g) => g.goalType === t.value).reduce((acc, g) => acc + g.targetAmount, 0),
    saved: goals.filter((g) => g.goalType === t.value).reduce((acc, g) => acc + g.currentAmount, 0),
    count: goals.filter((g) => g.goalType === t.value).length,
  })).filter((t) => t.count > 0);

  const openAddForm = () => {
    setForm({ ...EMPTY_FORM, accountId: accounts[0]?.id ?? '', categoryId: categories[0]?.id ?? '' });
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (goal: Goal) => {
    setForm({
      id: goal.id,
      emoji: goal.emoji ?? '🎯',
      name: goal.name,
      goalType: goal.goalType,
      beneficiary: goal.beneficiary ?? '',
      note: goal.note ?? '',
      targetAmount: String(goal.targetAmount),
      currentAmount: String(goal.currentAmount),
      monthlyContribution: String(goal.monthlyContribution),
      targetDate: goal.targetDate ? goal.targetDate.slice(0, 10) : '',
      accountId: goal.accountId ?? accounts[0]?.id ?? '',
      categoryId: goal.categoryId ?? '',
      autoContribute: goal.autoContribute,
      contributionDay: String(goal.contributionDay),
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
      setFormError('Nom requis');
      return;
    }
    const numericTarget = Number(form.targetAmount);
    if (!Number.isFinite(numericTarget) || numericTarget <= 0) {
      setFormError('Montant cible invalide');
      return;
    }
    if (form.autoContribute && (!form.accountId || !form.categoryId)) {
      setFormError("Compte et catégorie requis pour activer l'épargne automatique");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        emoji: form.emoji || '🎯',
        goalType: form.goalType,
        beneficiary: form.beneficiary.trim() || null,
        note: form.note.trim() || null,
        targetAmount: numericTarget,
        currentAmount: Number(form.currentAmount) || 0,
        monthlyContribution: Number(form.monthlyContribution) || 0,
        targetDate: form.targetDate || null,
        accountId: form.accountId || undefined,
        categoryId: form.categoryId || undefined,
        autoContribute: form.autoContribute,
        contributionDay: Number(form.contributionDay) || 1,
      };

      const res = form.id
        ? await fetch(`/api/goals/${form.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/goals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
      console.error('Goal save error:', err);
      setFormError('Erreur réseau');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/goals/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        setConfirmDeleteId(null);
        load();
      }
    } catch (err) {
      console.error('Goal delete error:', err);
    } finally {
      setBusyId(null);
    }
  };

  const handleAddContribution = async (goalId: string) => {
    const numericAmount = Number(contribAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return;
    setContribSaving(true);
    try {
      const res = await fetch(`/api/goals/${goalId}/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numericAmount, note: contribNote.trim() || undefined }),
      });
      const result = await res.json();
      if (result.success) {
        setContributingGoalId(null);
        setContribAmount('');
        setContribNote('');
        load();
        if (expandedGoalId === goalId) loadHistory(goalId);
      }
    } catch (err) {
      console.error('Add contribution error:', err);
    } finally {
      setContribSaving(false);
    }
  };

  const loadHistory = (goalId: string) => {
    setHistoryLoading(goalId);
    fetch(`/api/goals/${goalId}/contributions`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setHistory((h) => ({ ...h, [goalId]: result.data }));
      })
      .catch((err) => console.error('History fetch error:', err))
      .finally(() => setHistoryLoading(null));
  };

  const toggleHistory = (goalId: string) => {
    if (expandedGoalId === goalId) {
      setExpandedGoalId(null);
      return;
    }
    setExpandedGoalId(goalId);
    if (!history[goalId]) loadHistory(goalId);
  };

  return (
    <div className="space-y-6">
      {/* Résumé global */}
      <div className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="p-3 border bg-blue-600/20 rounded-xl border-blue-500/20">
            <Wallet className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-subtle text-xs uppercase tracking-widest font-bold">Total épargné / cible</p>
            <p className="text-2xl font-black text-ink">
              {formatDH(totalSaved)} <span className="text-subtle text-base font-medium">/ {formatDH(totalTarget)}</span>
            </p>
          </div>
        </div>
        {totalsByType.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-line-subtle">
            {totalsByType.map((t) => {
              const style = TYPE_STYLES[t.color];
              const Icon = t.icon;
              return (
                <div key={t.value} className={`p-3 rounded-xl border ${style.bg} ${style.border}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={`w-3.5 h-3.5 ${style.text}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${style.text}`}>{t.label}</span>
                  </div>
                  <p className="text-sm font-black text-ink">{formatDH(t.saved)}</p>
                  <p className="text-[10px] text-subtle">sur {formatDH(t.target)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bouton ajout */}
      <div className="flex justify-end">
        <button
          onClick={openAddForm}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          Ajouter un objectif
        </button>
      </div>

      {/* Formulaire ajout / édition */}
      {showForm && (
        <div className="bg-surface rounded-2xl border border-line p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black tracking-tight uppercase text-ink">
              {form.id ? "Modifier l'objectif" : 'Nouvel objectif'}
            </h3>
            <button onClick={closeForm} className="p-1.5 text-muted hover:text-ink rounded-lg hover:bg-surface-alt">
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
              {formError}
            </div>
          )}

          {!form.id && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Partir d&apos;un modèle (optionnel)
              </label>
              <select
                defaultValue=""
                onChange={(e) => {
                  const template = findGoalTemplate(e.target.value);
                  if (!template) return;
                  setForm((f) => ({
                    ...f,
                    emoji: template.emoji,
                    name: template.label,
                    goalType: template.goalType,
                    note: template.suggestedNote ?? f.note,
                  }));
                }}
                className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
              >
                <option value="">— Personnalisé —</option>
                {GOAL_TEMPLATES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.emoji} {t.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Emoji</label>
              <input
                type="text"
                maxLength={2}
                value={form.emoji}
                onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                className="w-full bg-page border border-line text-body rounded-lg p-3 text-center focus:border-blue-500 outline-none transition-colors text-sm"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Nom</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Frais de scolarité de ma sœur"
                className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Type</label>
              <select
                value={form.goalType}
                onChange={(e) => setForm((f) => ({ ...f, goalType: e.target.value }))}
                className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
              >
                {GOAL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {form.goalType === 'famille' && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                Bénéficiaire (pour qui ?)
              </label>
              <input
                type="text"
                value={form.beneficiary}
                onChange={(e) => setForm((f) => ({ ...f, beneficiary: e.target.value }))}
                placeholder="Ma sœur — Salma"
                className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Note (optionnel)</label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Rentrée scolaire 2026-2027"
              className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Cible (DH)</label>
              <input
                type="number"
                step="any"
                value={form.targetAmount}
                onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))}
                className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Déjà épargné</label>
              <input
                type="number"
                step="any"
                value={form.currentAmount}
                onChange={(e) => setForm((f) => ({ ...f, currentAmount: e.target.value }))}
                className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Date limite (optionnel)</label>
              <input
                type="date"
                value={form.targetDate}
                onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
                className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Compte</label>
              <select
                value={form.accountId}
                onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
                className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
              >
                <option value="">— Aucun —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Catégorie</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
              >
                <option value="">— Aucune —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-4 border rounded-xl border-line-subtle bg-surface-alt/40 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.autoContribute}
                onChange={(e) => setForm((f) => ({ ...f, autoContribute: e.target.checked }))}
                className="w-4 h-4 accent-emerald-600"
              />
              <span className="text-sm font-bold text-ink">Épargne automatique mensuelle</span>
            </label>
            <p className="text-[11px] text-faint">
              Prélève automatiquement la contribution/mois du compte choisi, le jour indiqué, chaque mois — comme un
              abonnement, mais vers cet objectif.
            </p>
            {form.autoContribute && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                    Contribution/mois (DH)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.monthlyContribution}
                    onChange={(e) => setForm((f) => ({ ...f, monthlyContribution: e.target.value }))}
                    className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Jour du mois</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={form.contributionDay}
                    onChange={(e) => setForm((f) => ({ ...f, contributionDay: e.target.value }))}
                    className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
                  />
                </div>
              </div>
            )}
            {!form.autoContribute && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                  Contribution/mois indicative (DH)
                </label>
                <input
                  type="number"
                  step="any"
                  value={form.monthlyContribution}
                  onChange={(e) => setForm((f) => ({ ...f, monthlyContribution: e.target.value }))}
                  placeholder="Sert juste à estimer le temps restant"
                  className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {form.id ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </div>
      )}

      {/* Liste des objectifs */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-12 h-12 border-b-2 border-blue-500 rounded-full animate-spin" />
        </div>
      ) : goals.length === 0 ? (
        <div className="p-10 text-center border bg-surface rounded-2xl border-line">
          <Target className="w-8 h-8 text-subtle mx-auto mb-3" />
          <p className="text-subtle text-sm">Aucun objectif pour le moment. Ajoute le premier ci-dessus.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const progressPct = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
            const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
            const monthsLeft = goal.monthlyContribution > 0 ? Math.ceil(remaining / goal.monthlyContribution) : null;
            const status = getStatus(progressPct);
            const typeInfo = goalTypeInfo(goal.goalType);
            const typeStyle = TYPE_STYLES[typeInfo.color];
            const TypeIcon = typeInfo.icon;

            let deadlineInfo: string | null = null;
            if (goal.targetDate) {
              const m = monthsUntil(goal.targetDate);
              const suggested = m > 0 ? remaining / m : remaining;
              deadlineInfo = `Échéance : ${formatDate(goal.targetDate)} (${m} mois) — ~${formatDH(suggested)}/mois pour y arriver`;
            }

            return (
              <div key={goal.id} className="border bg-surface rounded-2xl border-line overflow-hidden">
                <div className="p-4 sm:p-5 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl shrink-0">{goal.emoji || '🎯'}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-ink text-sm">{goal.name}</p>
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${typeStyle.bg} ${typeStyle.border} ${typeStyle.text}`}
                          >
                            <TypeIcon className="w-2.5 h-2.5" />
                            {typeInfo.label}
                          </span>
                          {goal.autoContribute && (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                              Auto
                            </span>
                          )}
                        </div>
                        {goal.beneficiary && <p className="text-xs text-subtle mt-0.5">Pour : {goal.beneficiary}</p>}
                        {goal.note && <p className="text-[11px] text-faint mt-0.5">{goal.note}</p>}
                      </div>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase whitespace-nowrap ${status.color}`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-subtle font-bold">{progressPct.toFixed(1)}%</span>
                      <span className="text-muted">
                        {formatDH(goal.currentAmount)} / {formatDH(goal.targetAmount)}
                      </span>
                    </div>
                    <div className="w-full bg-surface-strong h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-faint flex flex-wrap items-center gap-x-4 gap-y-1">
                    {deadlineInfo ? (
                      <span className="flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" />
                        {deadlineInfo}
                      </span>
                    ) : (
                      <span>
                        Contrib/mois : {formatDH(goal.monthlyContribution)}
                        {monthsLeft !== null ? ` · ${monthsLeft} mois restants` : ''}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => setContributingGoalId(contributingGoalId === goal.id ? null : goal.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-400 border rounded-lg border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Ajouter un versement
                    </button>
                    <button
                      onClick={() => toggleHistory(goal.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg border-line text-body-soft hover:bg-surface-alt transition-colors"
                    >
                      <History className="w-3.5 h-3.5" />
                      Historique
                    </button>
                    <button
                      onClick={() => openEditForm(goal)}
                      className="p-1.5 border rounded-lg border-line text-body-soft hover:bg-surface-alt transition-colors"
                      aria-label="Modifier"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {confirmDeleteId === goal.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleDelete(goal.id)}
                          disabled={busyId === goal.id}
                          className="p-1.5 border rounded-lg border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        >
                          {busyId === goal.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="p-1.5 border rounded-lg border-line text-body-soft hover:bg-surface-alt transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(goal.id)}
                        className="p-1.5 border rounded-lg border-line text-body-soft hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {contributingGoalId === goal.id && (
                    <div className="flex flex-wrap items-end gap-2 p-3 border rounded-xl border-line-subtle bg-surface-alt/40">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-subtle">Montant (DH)</label>
                        <input
                          type="number"
                          step="any"
                          value={contribAmount}
                          onChange={(e) => setContribAmount(e.target.value)}
                          className="w-32 bg-page border border-line text-body rounded-lg p-2 focus:border-blue-500 outline-none text-sm"
                        />
                      </div>
                      <div className="space-y-1 flex-1 min-w-[140px]">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-subtle">Note (optionnel)</label>
                        <input
                          type="text"
                          value={contribNote}
                          onChange={(e) => setContribNote(e.target.value)}
                          className="w-full bg-page border border-line text-body rounded-lg p-2 focus:border-blue-500 outline-none text-sm"
                        />
                      </div>
                      <button
                        onClick={() => handleAddContribution(goal.id)}
                        disabled={contribSaving}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                      >
                        {contribSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Valider
                      </button>
                    </div>
                  )}

                  {expandedGoalId === goal.id && (
                    <div className="border-t border-line-subtle pt-3 space-y-1.5">
                      {historyLoading === goal.id ? (
                        <div className="flex items-center gap-2 text-xs text-subtle">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Chargement...
                        </div>
                      ) : (history[goal.id] ?? []).length === 0 ? (
                        <p className="text-xs text-subtle italic">Aucun versement enregistré pour l&apos;instant.</p>
                      ) : (
                        (history[goal.id] ?? []).map((c) => (
                          <div key={c.id} className="flex items-center justify-between text-xs py-1">
                            <div className="flex items-center gap-2 text-body-soft">
                              <span>{formatDate(c.date)}</span>
                              {c.isAutomatic && (
                                <span className="text-[9px] font-bold uppercase text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded">
                                  Auto
                                </span>
                              )}
                              {c.note && <span className="text-faint">— {c.note}</span>}
                            </div>
                            <span className="font-bold text-ink">{formatDH(c.amount)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
