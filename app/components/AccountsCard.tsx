'use client';

import { useEffect, useState } from 'react';
import { Wallet, Loader2, Plus, Pencil, Trash2, Check, X } from 'lucide-react';

interface AccountRow {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
}

const TYPE_LABELS: Record<string, string> = {
  checking: 'Compte courant',
  savings: 'Épargne',
  investment: 'Investissement',
};

export default function AccountsCard() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [currencies, setCurrencies] = useState<string[]>(['MAD']);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('checking');
  const [currency, setCurrency] = useState('MAD');
  const [balance, setBalance] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const load = () => {
    fetch('/api/accounts')
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setAccounts(result.data);
          if (Array.isArray(result.currencies)) setCurrencies(result.currencies);
        }
      })
      .catch((err) => console.error('Accounts fetch error:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    setCreateError(null);
    if (!name.trim()) {
      setCreateError('Nom requis');
      return;
    }
    setCreateBusy(true);
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type, currency, balance: balance || 0 }),
      });
      const result = await res.json();
      if (!result.success) {
        setCreateError(result.error || 'Erreur lors de la création du compte');
        return;
      }
      setName('');
      setType('checking');
      setCurrency('MAD');
      setBalance('');
      setShowForm(false);
      load();
    } catch (err) {
      console.error('Account create error:', err);
      setCreateError('Erreur réseau');
    } finally {
      setCreateBusy(false);
    }
  };

  const startRename = (account: AccountRow) => {
    setEditingId(account.id);
    setEditingName(account.name);
    setRowError(null);
  };

  const confirmRename = async (id: string) => {
    if (!editingName.trim()) return;
    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() }),
      });
      const result = await res.json();
      if (!result.success) {
        setRowError(result.error || 'Erreur lors du renommage');
        return;
      }
      setEditingId(null);
      load();
    } catch (err) {
      console.error('Account rename error:', err);
      setRowError('Erreur réseau');
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setRowError(null);
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!result.success) {
        setRowError(result.error || 'Erreur lors de la suppression');
        return;
      }
      load();
    } catch (err) {
      console.error('Account delete error:', err);
      setRowError('Erreur réseau');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 border bg-surface rounded-2xl border-line">
        <div className="flex items-center gap-2 text-xs text-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 border bg-surface rounded-2xl border-line space-y-4">
      <div className="flex items-center gap-4">
        <div className="p-3 border rounded-xl bg-emerald-600/20 border-emerald-500/20">
          <Wallet className="w-6 h-6 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-black tracking-tight uppercase text-ink">Comptes</h2>
          <p className="text-subtle text-xs mt-0.5">
            Comptes courants, épargne, investissement — chacun dans sa propre devise (MAD par défaut).
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        )}
      </div>

      {rowError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
          {rowError}
        </div>
      )}

      <div className="space-y-2 pt-4 border-t border-line-subtle">
        {accounts.length === 0 && <p className="text-xs text-subtle">Aucun compte pour l&apos;instant.</p>}
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center justify-between p-3 rounded-xl bg-surface-alt/50 border border-line/50 gap-3"
          >
            {editingId === account.id ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="flex-1 bg-page border border-line text-body rounded-lg p-2 text-sm outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => confirmRename(account.id)}
                  className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors shrink-0"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-1.5 text-subtle hover:bg-surface-alt rounded-lg transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-body-soft truncate">{account.name}</span>
                    {account.currency !== 'MAD' && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded shrink-0">
                        {account.currency}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-faint">{TYPE_LABELS[account.type] ?? account.type}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-bold text-body-soft tabular-nums">
                    {account.balance.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} {account.currency}
                  </span>
                  <button
                    onClick={() => startRename(account)}
                    className="p-1.5 text-subtle hover:text-body hover:bg-surface-alt rounded-lg transition-colors"
                    title="Renommer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(account.id)}
                    disabled={deletingId === account.id}
                    className="p-1.5 text-subtle hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Supprimer"
                  >
                    {deletingId === account.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {showForm && (
        <div className="space-y-3 pt-4 border-t border-line-subtle">
          {createError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
              {createError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Nom</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Wise USD"
                className="w-full bg-page border border-line text-body rounded-lg p-3 text-sm outline-none focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-page border border-line text-body rounded-lg p-3 text-sm outline-none focus:border-emerald-500"
              >
                <option value="checking">Compte courant</option>
                <option value="savings">Épargne</option>
                <option value="investment">Investissement</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Devise</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-page border border-line text-body rounded-lg p-3 text-sm outline-none focus:border-emerald-500"
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                Solde initial (optionnel)
              </label>
              <input
                type="number"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="0"
                className="w-full bg-page border border-line text-body rounded-lg p-3 text-sm outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCreate}
              disabled={createBusy}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
            >
              {createBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Créer le compte
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 text-sm font-medium border rounded-xl border-line text-body-soft hover:bg-surface-alt transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
