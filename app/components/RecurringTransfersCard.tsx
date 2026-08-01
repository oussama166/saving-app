'use client';

import { useEffect, useState } from 'react';
import { Repeat, Loader2, Plus, Check, X, Trash2, Pause, Play } from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { tParams } from '@/lib/i18n';

interface AccountRow {
  id: string;
  name: string;
  currency: string;
}

interface RecurringTransferRule {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  dayOfMonth: number;
  active: boolean;
  lastRunAt: string | null;
}

// Règles de virement automatique récurrent (voir lib/recurringTransfers.ts
// pour l'exécution, déclenchée par un cron externe quotidien — cette carte
// ne fait que créer/lister/activer/supprimer des règles, jamais l'exécution
// elle-même). Charge ses propres comptes (comme TransferCard/AccountsCard)
// et le jour de paie déjà configuré (Profil > budget) pour pré-remplir le
// jour du mois par défaut.
export default function RecurringTransfersCard() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [rules, setRules] = useState<RecurringTransferRule[]>([]);
  const [defaultDay, setDefaultDay] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const load = () => {
    Promise.all([
      fetch('/api/accounts').then((res) => res.json()),
      fetch('/api/recurring-transfers').then((res) => res.json()),
      fetch('/api/settings').then((res) => res.json()),
    ])
      .then(([accountsResult, rulesResult, settingsResult]) => {
        if (accountsResult.success) {
          const list: AccountRow[] = accountsResult.data;
          setAccounts(list);
          setFromAccountId((prev) => (list.some((a) => a.id === prev) ? prev : (list[0]?.id ?? '')));
          setToAccountId((prev) => (list.some((a) => a.id === prev) ? prev : (list[1]?.id ?? list[0]?.id ?? '')));
        }
        if (rulesResult.success) setRules(rulesResult.data);
        if (settingsResult.success && settingsResult.data?.budgetCycleStartDay) {
          const day = settingsResult.data.budgetCycleStartDay;
          setDefaultDay(day);
          setDayOfMonth((prev) => (prev === '1' ? String(day) : prev));
        }
      })
      .catch((err) => console.error('Recurring transfers fetch error:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? id;
  const sameAccount = Boolean(fromAccountId) && fromAccountId === toAccountId;
  const numericAmount = Number(amount);
  const amountValid = amount !== '' && Number.isFinite(numericAmount) && numericAmount > 0;
  const numericDay = Number(dayOfMonth);
  const dayValid = Number.isInteger(numericDay) && numericDay >= 1 && numericDay <= 28;

  const handleCreate = async () => {
    setCreateError(null);
    if (sameAccount) {
      setCreateError(t('transfer.errorSameAccount'));
      return;
    }
    if (!amountValid || !dayValid) return;

    setCreateBusy(true);
    try {
      const res = await fetch('/api/recurring-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromAccountId, toAccountId, amount: numericAmount, dayOfMonth: numericDay }),
      });
      const result = await res.json();
      if (!result.success) {
        setCreateError(result.error || t('recurringTransfer.errorGeneric'));
        return;
      }
      setAmount('');
      setDayOfMonth(String(defaultDay));
      setShowForm(false);
      load();
    } catch (err) {
      console.error('Recurring transfer create error:', err);
      setCreateError(t('recurringTransfer.errorGeneric'));
    } finally {
      setCreateBusy(false);
    }
  };

  const toggleActive = async (rule: RecurringTransferRule) => {
    setBusyId(rule.id);
    setRowError(null);
    try {
      const res = await fetch(`/api/recurring-transfers/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !rule.active }),
      });
      const result = await res.json();
      if (!result.success) {
        setRowError(result.error || t('recurringTransfer.errorGeneric'));
        return;
      }
      load();
    } catch (err) {
      console.error('Recurring transfer toggle error:', err);
      setRowError(t('recurringTransfer.errorGeneric'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (rule: RecurringTransferRule) => {
    if (!confirm(t('recurringTransfer.deleteConfirm'))) return;
    setBusyId(rule.id);
    setRowError(null);
    try {
      const res = await fetch(`/api/recurring-transfers/${rule.id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!result.success) {
        setRowError(result.error || t('recurringTransfer.errorGeneric'));
        return;
      }
      load();
    } catch (err) {
      console.error('Recurring transfer delete error:', err);
      setRowError(t('recurringTransfer.errorGeneric'));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 border bg-surface rounded-2xl border-line">
        <div className="flex items-center gap-2 text-xs text-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('common.loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 border bg-surface rounded-2xl border-line space-y-4">
      <div className="flex items-center gap-4">
        <div className="p-3 border rounded-xl bg-indigo-600/20 border-indigo-500/20">
          <Repeat className="w-6 h-6 text-indigo-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-black tracking-tight uppercase text-ink">{t('recurringTransfer.title')}</h2>
          <p className="text-subtle text-xs mt-0.5">{t('recurringTransfer.subtitle')}</p>
        </div>
        {accounts.length > 1 && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            {t('recurringTransfer.add')}
          </button>
        )}
      </div>

      {accounts.length < 2 ? (
        <p className="text-xs text-subtle pt-4 border-t border-line-subtle">{t('recurringTransfer.needTwoAccounts')}</p>
      ) : (
        <>
          {rowError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
              {rowError}
            </div>
          )}

          <div className="space-y-2 pt-4 border-t border-line-subtle">
            {rules.length === 0 && <p className="text-xs text-subtle">{t('recurringTransfer.empty')}</p>}
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between p-3 rounded-xl bg-surface-alt/50 border border-line/50 gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-body-soft">
                      {accountName(rule.fromAccountId)} → {accountName(rule.toAccountId)}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${
                        rule.active
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : 'text-subtle bg-surface-alt border border-line'
                      }`}
                    >
                      {rule.active ? t('recurringTransfer.active') : t('recurringTransfer.paused')}
                    </span>
                  </div>
                  <p className="text-[11px] text-faint mt-0.5">
                    {tParams(t('recurringTransfer.everyMonthOn'), { day: rule.dayOfMonth })} ·{' '}
                    {rule.lastRunAt
                      ? `${t('recurringTransfer.lastRunLabel')} : ${new Date(rule.lastRunAt).toLocaleDateString('fr-FR')}`
                      : t('recurringTransfer.neverRun')}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-bold text-body-soft tabular-nums">
                    {rule.amount.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}{' '}
                    {accounts.find((a) => a.id === rule.fromAccountId)?.currency ?? ''}
                  </span>
                  <button
                    onClick={() => toggleActive(rule)}
                    disabled={busyId === rule.id}
                    className="p-1.5 text-subtle hover:text-body hover:bg-surface-alt rounded-lg transition-colors"
                    title={rule.active ? t('recurringTransfer.paused') : t('recurringTransfer.active')}
                  >
                    {busyId === rule.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : rule.active ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(rule)}
                    disabled={busyId === rule.id}
                    className="p-1.5 text-subtle hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                    {t('transfer.from')}
                  </label>
                  <select
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.target.value)}
                    className="w-full bg-page border border-line text-body rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                    {t('transfer.to')}
                  </label>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    className="w-full bg-page border border-line text-body rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                    {t('transfer.amount')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-page border border-line text-body rounded-lg p-2.5 text-sm font-bold outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                    {t('recurringTransfer.dayOfMonth')} ({t('recurringTransfer.dayOfMonthHint')})
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(e.target.value)}
                    className="w-full bg-page border border-line text-body rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {sameAccount && <p className="text-xs text-amber-300">{t('transfer.errorSameAccount')}</p>}

              <div className="flex items-center gap-3">
                <button
                  onClick={handleCreate}
                  disabled={createBusy || sameAccount || !amountValid || !dayValid}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
                >
                  {createBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {t('common.save')}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border rounded-xl border-line text-body-soft hover:bg-surface-alt transition-colors"
                >
                  <X className="w-4 h-4" />
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
