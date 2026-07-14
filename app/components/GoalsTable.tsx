'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Target, Pencil, Trash2, Check, PlusCircle } from 'lucide-react';

export interface Goal {
  id: string;
  name: string;
  emoji: string | null;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  autoAllocatePct: number;
}

const EMPTY_FORM = {
  id: '',
  name: '',
  emoji: '🎯',
  targetAmount: '',
  currentAmount: '',
  monthlyContribution: '',
};

function getStatus(progressPct: number) {
  if (progressPct >= 50) return { label: 'BIEN PARTI', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', emoji: '🟢' };
  if (progressPct >= 20) return { label: 'ENCORE UN EFFORT', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', emoji: '🟠' };
  return { label: 'DÉMARRER VITE', color: 'text-red-400 bg-red-500/10 border-red-500/20', emoji: '🔴' };
}

export default function GoalsTable({ goals }: { goals: Goal[] }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);

  const formatDH = (amt: number) =>
    new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amt).replace('MAD', 'DH');

  const handleEdit = (goal: Goal) => {
    setForm({
      id: goal.id,
      name: goal.name,
      emoji: goal.emoji ?? '🎯',
      targetAmount: String(goal.targetAmount),
      currentAmount: String(goal.currentAmount),
      monthlyContribution: String(goal.monthlyContribution),
    });
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cet objectif ?')) return;
    await fetch(`/api/goals/${id}`, { method: 'DELETE' });
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(form.id ? `/api/goals/${form.id}` : '/api/goals', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          emoji: form.emoji,
          targetAmount: form.targetAmount,
          currentAmount: form.currentAmount || 0,
          monthlyContribution: form.monthlyContribution || 0,
        }),
      });
      if (res.ok) {
        setForm(EMPTY_FORM);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#1b253b] rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-white">Vos Objectifs en Cours</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="text-slate-500 bg-slate-900/50">
                <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">Objectif</th>
                <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">Cible (DH)</th>
                <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">Épargné</th>
                <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">
                  Contrib/mois
                </th>
                <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800 w-40">
                  Progression
                </th>
                <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">
                  Mois restants
                </th>
                <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">Statut</th>
                <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {goals.map((goal) => {
                const progressPct = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
                const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
                const monthsLeft = goal.monthlyContribution > 0 ? Math.ceil(remaining / goal.monthlyContribution) : null;
                const status = getStatus(progressPct);

                return (
                  <tr key={goal.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="py-3 px-5 font-bold text-slate-200">
                      {goal.emoji} {goal.name}
                    </td>
                    <td className="py-3 px-5 text-slate-400">{formatDH(goal.targetAmount)}</td>
                    <td className="py-3 px-5 text-slate-400">{formatDH(goal.currentAmount)}</td>
                    <td className="py-3 px-5 text-slate-400">{formatDH(goal.monthlyContribution)}</td>
                    <td className="py-3 px-5">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] text-slate-500 font-bold">{progressPct.toFixed(1)}%</span>
                        <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-slate-400">{monthsLeft !== null ? monthsLeft : '—'}</td>
                    <td className="py-3 px-5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase ${status.color}`}>
                        {status.emoji} {status.label}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(goal)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600/20 text-slate-400 hover:text-blue-400 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(goal.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-600/20 text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {goals.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500 italic">
                    Aucun objectif pour le moment. Ajoute le premier ci-dessous.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Update Form */}
      <div className="bg-[#1b253b] rounded-xl border border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
            <PlusCircle className="w-5 h-5 text-emerald-500" />
          </div>
          <h3 className="text-lg font-bold text-white tracking-tight">
            {form.id ? "Modifier l'objectif" : 'Ajouter un objectif'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Emoji</label>
            <input
              type="text"
              value={form.emoji}
              onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              className="bg-[#131b2c] border border-slate-700 text-slate-200 rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm text-center"
              maxLength={2}
            />
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Nom</label>
            <input
              type="text"
              placeholder="Ex: Voyage Europe Été"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-[#131b2c] border border-slate-700 text-slate-200 rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Cible (DH)</label>
            <input
              type="number"
              step="any"
              placeholder="0"
              value={form.targetAmount}
              onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
              className="bg-[#131b2c] border border-slate-700 text-slate-200 rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">
              Déjà épargné
            </label>
            <input
              type="number"
              step="any"
              placeholder="0"
              value={form.currentAmount}
              onChange={(e) => setForm({ ...form, currentAmount: e.target.value })}
              className="bg-[#131b2c] border border-slate-700 text-slate-200 rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">
              Contrib/mois
            </label>
            <input
              type="number"
              step="any"
              placeholder="0"
              value={form.monthlyContribution}
              onChange={(e) => setForm({ ...form, monthlyContribution: e.target.value })}
              className="bg-[#131b2c] border border-slate-700 text-slate-200 rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm"
            />
          </div>

          <div className="flex gap-3 md:col-span-6">
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-6 rounded-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50 text-sm"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {form.id ? 'Mettre à jour' : 'Ajouter'}
                </>
              )}
            </button>
            {form.id && (
              <button
                type="button"
                onClick={() => setForm(EMPTY_FORM)}
                className="text-slate-400 hover:text-slate-200 text-sm font-medium px-4"
              >
                Annuler
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
