'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { Trash2, Pencil, Check, Search, Download, X, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
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
    type: string;
  };
  account: {
    id?: string;
    name: string;
  };
}

interface SubCategory {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
  // Optionnel : nécessaire pour peupler le sélecteur de sous-catégorie de la
  // ligne en édition (voir startEdit) — absent si l'appelant ne le fournit
  // pas, l'édition retombe simplement sur "aucune sous-catégorie".
  subCategories?: SubCategory[];
}

const PAYMENT_METHODS = [
  { value: 'Carte Bancaire', labelKey: 'payment.bankCard' },
  { value: 'Virement Bancaire', labelKey: 'payment.bankTransfer' },
  { value: 'Espèces', labelKey: 'payment.cash' },
  { value: 'Chèque', labelKey: 'payment.check' },
  { value: 'CIH Pay/Mobile', labelKey: 'payment.cihPay' },
  { value: 'PayPal', labelKey: 'payment.paypal' },
  { value: 'Apple Pay', labelKey: 'payment.applePay' },
  { value: 'BMCE DIRECT', labelKey: 'payment.bmceDirect' },
] as const;

interface AccountOption {
  id: string;
  name: string;
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
  accounts?: AccountOption[];
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
  accounts = [],
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
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // Sélection manuelle via cases à cocher (indépendante du bouton "Supprimer
  // les résultats", qui lui supprime TOUT ce qui correspond au filtre sans
  // avoir besoin de cocher ligne par ligne) — réinitialisée à chaque
  // changement de filtre/page puisque les ids affichés changent.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Édition en ligne — remplace les cellules de la ligne par des champs le
  // temps de la correction, plutôt qu'un modal séparé (voir PATCH
  // /api/transactions/[id]). Le montant est saisi en valeur absolue, comme
  // dans TransactionForm : le signe suit toujours le type de la catégorie
  // choisie, jamais un champ séparé.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    date: string;
    categoryId: string;
    subCategory: string;
    paymentMethod: string;
    accountId: string;
    merchant: string;
    amount: string;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TypeFilter>('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
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
    if (accountId) params.set('accountId', accountId);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(offset));

    setLoading(true);
    setSelectedIds(new Set());
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
  }, [search, type, categoryId, accountId, dateFrom, dateTo, sortBy, sortDir, offset]);

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
        setSelectedIds((prev) => {
          if (!prev.has(tx.id)) return prev;
          const next = new Set(prev);
          next.delete(tx.id);
          return next;
        });
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

  // Suppression groupée de TOUT ce qui correspond au filtre actif (voir
  // DELETE /api/transactions/bulk) — utile pour nettoyer d'un coup des
  // dizaines de transactions de test (ex: abonnements de test ajoutés
  // plusieurs fois puis supprimés côté /abonnements, dont les dépenses
  // restaient orphelines dans l'historique) sans les supprimer une par une.
  // Réutilise EXACTEMENT les mêmes filtres que la liste affichée à l'écran —
  // la route refuse d'ailleurs tout appel sans filtre actif, en garde-fou
  // supplémentaire côté serveur.
  const handleBulkDelete = async () => {
    if (!hasActiveFilters || total === 0) return;
    if (!confirm(`${t('historique.bulkDeleteConfirm')} (${total})`)) return;

    setBulkDeleting(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (type) params.set('type', type);
      if (categoryId) params.set('categoryId', categoryId);
      if (accountId) params.set('accountId', accountId);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/transactions/bulk?${params.toString()}`, { method: 'DELETE' });
      const result = await res.json();
      if (!result.success) return;

      // Refetch avec les mêmes filtres (l'effet de chargement ne se
      // redéclenche pas tout seul puisqu'aucune dépendance n'a changé) — le
      // filtre reste actif, l'utilisateur voit "0 résultat" en confirmation
      // visuelle que le nettoyage a bien eu lieu.
      setOffset(0);
      params.set('sortBy', sortBy);
      params.set('sortDir', sortDir);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', '0');
      const listRes = await fetch(`/api/transactions?${params.toString()}`);
      const listResult = await listRes.json();
      if (listResult.success) {
        setTransactions(listResult.data);
        setTotal(listResult.total);
        setSummary(listResult.summary);
      }
    } catch (error) {
      console.error('Bulk delete error:', error);
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allOnPageSelected = transactions.length > 0 && transactions.every((tx) => selectedIds.has(tx.id));

  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        transactions.forEach((tx) => next.delete(tx.id));
      } else {
        transactions.forEach((tx) => next.add(tx.id));
      }
      return next;
    });
  };

  // Suppression d'une sélection manuelle (cases à cocher) — même route que
  // handleBulkDelete mais en mode { ids } plutôt que filtre, donc utilisable
  // même sans filtre actif (ex: repérer visuellement 3 lignes de test parmi
  // des résultats non filtrés et ne supprimer que celles-là).
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${t('historique.deleteSelectedConfirm')} (${selectedIds.size})`)) return;

    setBulkDeleting(true);
    try {
      const res = await fetch('/api/transactions/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const result = await res.json();
      if (!result.success) return;

      setSelectedIds(new Set());

      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (type) params.set('type', type);
      if (categoryId) params.set('categoryId', categoryId);
      if (accountId) params.set('accountId', accountId);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      params.set('sortBy', sortBy);
      params.set('sortDir', sortDir);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(offset));
      const listRes = await fetch(`/api/transactions?${params.toString()}`);
      const listResult = await listRes.json();
      if (listResult.success) {
        setTransactions(listResult.data);
        setTotal(listResult.total);
        setSummary(listResult.summary);
      }
    } catch (error) {
      console.error('Delete selected error:', error);
    } finally {
      setBulkDeleting(false);
    }
  };

  const startEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setEditError(null);
    setEditForm({
      date: new Date(tx.date).toISOString().split('T')[0],
      categoryId: tx.category.id ?? '',
      subCategory: tx.subCategory ?? '',
      paymentMethod: tx.paymentMethod ?? '',
      accountId: tx.account.id ?? '',
      merchant: tx.merchant,
      amount: String(Math.abs(tx.amount)),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editForm) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/transactions/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: editForm.date,
          categoryId: editForm.categoryId,
          subCategory: editForm.subCategory || undefined,
          paymentMethod: editForm.paymentMethod || undefined,
          notes: editForm.merchant,
          amount: editForm.amount,
          accountId: editForm.accountId || undefined,
        }),
      });
      const result = await res.json();
      if (!result.success) {
        setEditError(result.error || t('historique.editError'));
        return;
      }

      const oldTx = transactions.find((tx) => tx.id === editingId);
      const updated: Transaction = result.data;
      setTransactions((prev) => prev.map((tx) => (tx.id === editingId ? updated : tx)));
      if (oldTx) {
        setSummary((prev) => {
          const next = { ...prev };
          // Retire l'ancienne contribution au résumé...
          if (oldTx.category.type === 'income') next.totalIncome -= oldTx.amount;
          else if (oldTx.category.type === 'savings') next.totalSavings -= Math.abs(oldTx.amount);
          else next.totalExpense -= Math.abs(oldTx.amount);
          // ...puis applique la nouvelle (catégorie/montant potentiellement changés).
          if (updated.category.type === 'income') next.totalIncome += updated.amount;
          else if (updated.category.type === 'savings') next.totalSavings += Math.abs(updated.amount);
          else next.totalExpense += Math.abs(updated.amount);
          next.net = next.totalIncome - next.totalExpense - next.totalSavings;
          return next;
        });
      }

      cancelEdit();
    } catch (error) {
      console.error('Edit Error:', error);
      setEditError(t('historique.editError'));
    } finally {
      setSavingEdit(false);
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
    setAccountId('');
    setDateFrom('');
    setDateTo('');
    setOffset(0);
  };

  const hasActiveFilters = Boolean(search || type || categoryId || accountId || dateFrom || dateTo);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (type) params.set('type', type);
      if (categoryId) params.set('categoryId', categoryId);
      if (accountId) params.set('accountId', accountId);
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

  const typeBadge = (txType: string) => {
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
  // Colonne "Compte" affichée seulement si le foyer a plus d'un compte (voir
  // <th>/<td> conditionnels ci-dessous) — les colSpan de la ligne vide et du
  // pied de tableau doivent suivre le même total de colonnes.
  const columnCount = accounts.length > 1 ? 10 : 9;
  const summaryMiddleColSpan = accounts.length > 1 ? 5 : 4;

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

          {accounts.length > 1 && (
            <select
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setOffset(0);
              }}
              className="bg-page border border-line rounded-lg px-2.5 py-1.5 text-[12px] text-body focus:border-blue-500 outline-none"
            >
              <option value="">{t('common.allAccounts')}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}

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

          {hasActiveFilters && total > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-1 text-[11px] font-bold text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
            >
              {bulkDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              {t('historique.bulkDeleteButton')} ({total})
            </button>
          )}

          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={bulkDeleting}
              className="flex items-center gap-1 text-[11px] font-bold text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
            >
              {bulkDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              {t('historique.deleteSelectedButton')} ({selectedIds.size})
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
              <th className="py-3 px-5 border-b border-line-subtle w-8">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleSelectAllOnPage}
                  aria-label={t('historique.deleteSelectedButton')}
                />
              </th>
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
              {accounts.length > 1 && (
                <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-line-subtle">
                  {t('common.account')}
                </th>
              )}
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
            {transactions.map((tx) => {
              if (editingId === tx.id && editForm) {
                const editCategory = categories.find((c) => c.id === editForm.categoryId);
                const editSubCategories = editCategory?.subCategories ?? [];
                const inputCls =
                  'w-full bg-page border border-line rounded-md p-1.5 text-[11px] text-body outline-none focus:border-blue-500';
                return (
                  <Fragment key={tx.id}>
                    <tr className="bg-blue-500/5 ring-1 ring-inset ring-blue-500/20">
                      <td className="py-2 px-5" />
                      <td className="py-2 px-5">
                        <input
                          type="date"
                          value={editForm.date}
                          onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                          className={inputCls}
                        />
                      </td>
                      <td className="py-2 px-5">{typeBadge(editCategory?.type ?? tx.category.type)}</td>
                      <td className="py-2 px-5">
                        <select
                          value={editForm.categoryId}
                          onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value, subCategory: '' })}
                          className={inputCls}
                        >
                          {(['expense', 'income', 'savings'] as const).map((groupType) => {
                            const group = categories.filter((c) => c.type === groupType);
                            if (group.length === 0) return null;
                            return (
                              <optgroup
                                key={groupType}
                                label={t(
                                  groupType === 'expense'
                                    ? 'form.typeExpense'
                                    : groupType === 'income'
                                      ? 'form.typeIncome'
                                      : 'form.typeSavings',
                                )}
                              >
                                {group.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </optgroup>
                            );
                          })}
                        </select>
                      </td>
                      <td className="py-2 px-5">
                        <select
                          value={editForm.subCategory}
                          onChange={(e) => setEditForm({ ...editForm, subCategory: e.target.value })}
                          disabled={editSubCategories.length === 0}
                          className={`${inputCls} disabled:opacity-50`}
                        >
                          <option value="">{t('form.noSubcategory')}</option>
                          {editSubCategories.map((sub) => (
                            <option key={sub.id} value={sub.name}>
                              {sub.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-5">
                        <select
                          value={editForm.paymentMethod}
                          onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                          className={inputCls}
                        >
                          <option value="">—</option>
                          {PAYMENT_METHODS.map((m) => (
                            <option key={m.value} value={m.value}>
                              {t(m.labelKey)}
                            </option>
                          ))}
                        </select>
                      </td>
                      {accounts.length > 1 && (
                        <td className="py-2 px-5">
                          <select
                            value={editForm.accountId}
                            onChange={(e) => setEditForm({ ...editForm, accountId: e.target.value })}
                            className={inputCls}
                          >
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}
                      <td className="py-2 px-5">
                        <input
                          type="text"
                          value={editForm.merchant}
                          onChange={(e) => setEditForm({ ...editForm, merchant: e.target.value })}
                          className={inputCls}
                        />
                      </td>
                      <td className="py-2 px-5">
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.amount}
                          onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                          className={`${inputCls} text-right font-bold`}
                        />
                      </td>
                      <td className="py-2 px-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={handleSaveEdit}
                            disabled={savingEdit}
                            className="p-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 transition-colors disabled:opacity-50"
                            title={t('common.save')}
                          >
                            {savingEdit ? (
                              <div className="w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={savingEdit}
                            className="p-1.5 rounded-lg bg-surface-alt hover:bg-surface-strong text-muted transition-colors disabled:opacity-50"
                            title={t('common.cancel')}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editError && (
                      <tr className="bg-blue-500/5">
                        <td colSpan={columnCount} className="py-2 px-5 text-[11px] text-red-400">
                          {editError}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              }

              return (
                <tr key={tx.id} className="hover:bg-surface-alt/30 transition-colors group">
                  <td className="py-3 px-5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(tx.id)}
                      onChange={() => toggleSelect(tx.id)}
                      aria-label={t('historique.deleteSelectedButton')}
                    />
                  </td>
                  <td className="py-3 px-5 text-muted font-medium">{formatDate(tx.date)}</td>
                  <td className="py-3 px-5">{typeBadge(tx.category.type)}</td>
                  <td className="py-3 px-5">
                    <span className="text-body font-bold">{tx.category.name}</span>
                  </td>
                  <td className="py-3 px-5 text-muted">{tx.subCategory || '-'}</td>
                  <td className="py-3 px-5 text-muted">{tx.paymentMethod || '-'}</td>
                  {accounts.length > 1 && <td className="py-3 px-5 text-muted">{tx.account.name}</td>}
                  <td className="py-3 px-5 text-body-soft max-w-xs truncate">{tx.merchant}</td>
                  <td
                    className={`py-3 px-5 text-right font-black ${tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}
                  >
                    {tx.amount > 0 ? '+' : ''}
                    {formatMAD(tx.amount)}
                  </td>
                  <td className="py-3 px-5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => startEdit(tx)}
                        className="p-1.5 rounded-lg bg-surface-alt hover:bg-blue-600/20 text-muted hover:text-blue-400 transition-colors"
                        title={t('common.edit')}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(tx)}
                        disabled={deletingId === tx.id}
                        className="p-1.5 rounded-lg bg-surface-alt hover:bg-red-600/20 text-muted hover:text-red-400 transition-colors disabled:opacity-50"
                        title={t('common.delete')}
                      >
                        {deletingId === tx.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {transactions.length === 0 && !loading && (
              <tr>
                <td colSpan={columnCount} className="py-20 text-center text-subtle italic">
                  {t('historique.noTransactions')}
                </td>
              </tr>
            )}
          </tbody>
          {transactions.length > 0 && (
            <tfoot>
              <tr className="bg-surface-deep/50 border-t border-line-subtle">
                <td className="py-3 px-5" />
                <td colSpan={2} className="py-3 px-5 text-[10px] font-bold uppercase text-subtle">
                  {t('common.total')} ({summary.count})
                </td>
                <td colSpan={summaryMiddleColSpan} className="py-3 px-5 text-[11px] text-subtle">
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
