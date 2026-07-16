'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2, Search, Download, X, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from './LanguageProvider';

interface Transaction {
  id: string;
  date: string | Date;
  amount: number;
  merchant: string;
  subCategory?: string | null;
  paymentMethod?: string | null;
  category: {
    id?: string;
    name: string;
    type: 'income' | 'expense' | 'savings';
  };
  account: {
    name: string;
  };
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Summary {
  count: number;
  totalIncome: number;
  totalExpense: number;
  totalSavings: number;
  net: number;
}

interface HistoryTableProps {
  initialTransactions: Transaction[];
  initialTotal: number;
  initialSummary: Summary;
  categories: Category[];
}

type TypeFilter = '' | 'income' | 'expense' | 'savings';
type SortBy = 'date' | 'amount';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 50;

export default function HistoryTable({
  initialTransactions,
  initialTotal,
  initialSummary,
  categories,
}: HistoryTableProps) {
  const { t } = useLanguage();

  const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
    { key: '', label: t('common.all') },
    { key: 'income', label: t('common.income') },
    { key: 'expense', label: t('common.expense') },
    { key: 'savings', label: t('common.savings') },
  ];

  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [total, setTotal] = useState(initialTotal);
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TypeFilter>('');
  const [categoryId, setCategoryId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [offset, setOffset] = useState(0);

  const didMount = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Debounce de la recherche texte (300ms) avant de déclencher un fetch.
  // Revient aussi à la première page — dans le callback du timer, pas
  // directement dans le corps de l'effet, pour éviter toute cascade de
  // re-renders synchrones.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    // Le premier rendu utilise déjà les données SSR (filtres par défaut) —
    // pas besoin de re-fetcher immédiatement au montage.
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (type) params.set('type', type);
    if (categoryId) params.set('categoryId', categoryId);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(offset));

    setLoading(true);
    fetch(`/api/transactions?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setTransactions(result.data);
          setTotal(result.total);
          setSummary(result.summary);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.error('History fetch error:', err);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [search, type, categoryId, dateFrom, dateTo, sortBy, sortDir, offset]);

  const formatMAD = (amt: number) =>
    new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amt);

  const formatDate = (date: string | Date) =>
    new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const handleDelete = async (tx: Transaction) => {
    if (!confirm(`${t('historique.deleteConfirm')} "${tx.merchant}" (${formatMAD(tx.amount)}) — ${formatDate(tx.date)} ?`)) {
      return;
    }

    setDeletingId(tx.id);
    try {
      const res = await fetch(`/api/transactions/${tx.id}`, { method: 'DELETE' });
      if (res.ok) {
        setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
        setTotal((prev) => Math.max(prev - 1, 0));
        setSummary((prev) => {
          const next = { ...prev, count: Math.max(prev.count - 1, 0) };
          if (tx.category.type === 'income') next.totalIncome -= tx.amount;
          else if (tx.category.type === 'savings') next.totalSavings -= Math.abs(tx.amount);
          else next.totalExpense -= Math.abs(tx.amount);
          next.net = next.totalIncome - next.totalExpense - next.totalSavings;
          return next;
        });
      }
    } catch (error) {
      console.error('Delete Error:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSort = (col: SortBy) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setOffset(0);
  };

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setType('');
    setCategoryId('');
    setDateFrom('');
    setDateTo('');
    setOffset(0);
  };

  const hasActiveFilters = Boolean(search || type || categoryId || dateFrom || dateTo);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (type) params.set('type', type);
      if (categoryId) params.set('categoryId', categoryId);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      params.set('sortBy', sortBy);
      params.set('sortDir', sortDir);
      params.set('limit', String(Math.max(total, 1)));
      params.set('offset', '0');

      const res = await fetch(`/api/transactions?${params.toString()}`);
      const result = await res.json();
      if (!result.success) return;

      const rows: Transaction[] = result.data;
      const header = [
        t('common.date'),
        t('historique.type'),
        t('common.category'),
        t('common.subcategory'),
        t('common.method'),
        t('common.account'),
        t('common.description'),
        t('common.amount'),
      ];
      const csvLines = [
        header.join(','),
        ...rows.map((tx) =>
          [
            formatDate(tx.date),
            tx.category.type,
            tx.category.name,
            tx.subCategory || '',
            tx.paymentMethod || '',
            tx.account.name,
            `"${tx.merchant.replace(/"/g, '""')}"`,
            tx.amount,
          ].join(','),
        ),
      ];

      const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export CSV Error:', error);
    } finally {
      setExporting(false);
    }
  };

  const typeBadge = (txType: 'income' | 'expense' | 'savings') => {
    if (txType === 'income') {
      return (
        <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold uppercase">
          {t('common.income')}
        </span>
      );
    }
    if (txType === 'savings') {
      return (
        <span className="text-[9px] bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded border border-blue-500/20 font-bold uppercase">
          {t('common.savings')}
        </span>
      );
    }
    return (
      <span className="text-[9px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded border border-red-500/20 font-bold uppercase">
        {t('common.expense')}
      </span>
    );
  };

  const renderSortIcon = (col: SortBy) => {
    if (sortBy !== col) return null;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-2xl">
      <div className="p-5 border-b border-line-subtle flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink">{t('historique.title')}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={exporting || total === 0}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-lg bg-surface-alt border border-line text-subtle hover:text-body hover:bg-surface-strong transition-colors disabled:opacity-40"
            >
              <Download className="w-3 h-3" />
              {exporting ? t('common.exporting') : t('common.export')}
            </button>
            <span className="text-[10px] bg-surface-alt text-subtle px-2 py-1 rounded font-bold">
              {total} {t('common.records').toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('historique.searchPlaceholder')}
              className="w-full bg-page border border-line rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-body focus:border-blue-500 outline-none transition-colors"
            />
          </div>

          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setOffset(0);
            }}
            className="bg-page border border-line rounded-lg px-2.5 py-1.5 text-[12px] text-body focus:border-blue-500 outline-none"
          >
            <option value="">{t('common.allCategories')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setOffset(0);
            }}
            className="bg-page border border-line rounded-lg px-2.5 py-1.5 text-[12px] text-body focus:border-blue-500 outline-none"
          />
          <span className="text-subtle text-[11px]">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setOffset(0);
            }}
            className="bg-page border border-line rounded-lg px-2.5 py-1.5 text-[12px] text-body focus:border-blue-500 outline-none"
          />

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-[11px] font-medium text-subtle hover:text-red-400 transition-colors"
            >
              <X className="w-3 h-3" />
              {t('common.reset')}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setType(f.key);
                setOffset(0);
              }}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-colors ${
                type === f.key
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                  : 'bg-surface-alt text-subtle border-line hover:text-body'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto relative">
        {loading && (
          <div className="absolute inset-0 bg-surface/50 flex items-center justify-center z-10">
            <div className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
          </div>
        )}
        <table className="w-full text-left text-[11px]">
          <thead>
            <tr className="text-subtle bg-surface-deep/50">
              <th
                onClick={() => toggleSort('date')}
                className="py-3 px-5 font-bold uppercase tracking-wider border-b border-line-subtle cursor-pointer select-none hover:text-body"
              >
                <div className="flex items-center gap-1">
                  {t('common.date')} {renderSortIcon('date')}
                </div>
              </th>
              <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-line-subtle">
                {t('historique.type')}
              </th>
              <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-line-subtle">
                {t('common.category')}
              </th>
              <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-line-subtle">
                {t('common.subcategory')}
              </th>
              <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-line-subtle">
                {t('common.method')}
              </th>
              <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-line-subtle">
                {t('common.description')}
              </th>
              <th
                onClick={() => toggleSort('amount')}
                className="py-3 px-5 font-bold uppercase tracking-wider border-b border-line-subtle text-right cursor-pointer select-none hover:text-body"
              >
                <div className="flex items-center gap-1 justify-end">
                  {t('common.amount')} {renderSortIcon('amount')}
                </div>
              </th>
              <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-line-subtle text-right">
                {t('common.action')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-subtle/50">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-surface-alt/30 transition-colors group">
                <td className="py-3 px-5 text-muted font-medium">{formatDate(tx.date)}</td>
                <td className="py-3 px-5">{typeBadge(tx.category.type)}</td>
                <td className="py-3 px-5">
                  <span className="text-body font-bold">{tx.category.name}</span>
                </td>
                <td className="py-3 px-5 text-muted">{tx.subCategory || '-'}</td>
                <td className="py-3 px-5 text-muted">{tx.paymentMethod || '-'}</td>
                <td className="py-3 px-5 text-body-soft max-w-xs truncate">{tx.merchant}</td>
                <td
                  className={`py-3 px-5 text-right font-black ${tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {tx.amount > 0 ? '+' : ''}
                  {formatMAD(tx.amount)}
                </td>
                <td className="py-3 px-5 text-right">
                  <button
                    onClick={() => handleDelete(tx)}
                    disabled={deletingId === tx.id}
                    className="p-1.5 rounded-lg bg-surface-alt hover:bg-red-600/20 text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    title={t('common.delete')}
                  >
                    {deletingId === tx.id ? (
                      <div className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </td>
              </tr>
            ))}
            {transactions.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="py-20 text-center text-subtle italic">
                  {t('historique.noTransactions')}
                </td>
              </tr>
            )}
          </tbody>
          {transactions.length > 0 && (
            <tfoot>
              <tr className="bg-surface-deep/50 border-t border-line-subtle">
                <td colSpan={2} className="py-3 px-5 text-[10px] font-bold uppercase text-subtle">
                  {t('common.total')} ({summary.count})
                </td>
                <td colSpan={4} className="py-3 px-5 text-[11px] text-subtle">
                  <span className="text-emerald-400 font-bold">+{formatMAD(summary.totalIncome)}</span>
                  {' · '}
                  <span className="text-red-400 font-bold">-{formatMAD(summary.totalExpense)}</span>
                  {' · '}
                  <span className="text-blue-400 font-bold">
                    {t('common.savings')} {formatMAD(summary.totalSavings)}
                  </span>
                </td>
                <td colSpan={2} className="py-3 px-5 text-right font-black text-ink">
                  {t('common.net')} {summary.net >= 0 ? '+' : ''}
                  {formatMAD(summary.net)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-line-subtle">
          <span className="text-[11px] text-subtle">
            {t('common.page')} {page} / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset((o) => Math.max(o - PAGE_SIZE, 0))}
              disabled={offset === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-alt border border-line text-[11px] font-medium text-subtle hover:text-body disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              {t('common.previous')}
            </button>
            <button
              onClick={() => setOffset((o) => (o + PAGE_SIZE < total ? o + PAGE_SIZE : o))}
              disabled={offset + PAGE_SIZE >= total}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-alt border border-line text-[11px] font-medium text-subtle hover:text-body disabled:opacity-40 transition-colors"
            >
              {t('common.next')}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
