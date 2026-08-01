'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Check, AlertTriangle } from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { tParams } from '@/lib/i18n';

interface SubCategory {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
  subCategories?: SubCategory[];
}

export interface TransactionFormPrefill {
  date?: string;
  categoryId?: string;
  subCategory?: string;
  amount?: string;
  notes?: string;
}

interface AccountOption {
  id: string;
  name: string;
}

interface TransactionFormProps {
  categories: Category[];
  // Comptes du foyer — permet de choisir sur quel compte (courant, épargne,
  // ...) enregistrer la saisie manuelle. Optionnel/vide toléré : le serveur
  // retombe sur "Main Checking" si accountId est absent (voir
  // app/api/transactions/route.ts), donc les appelants existants qui ne
  // passent pas cette prop continuent de fonctionner à l'identique.
  accounts?: AccountOption[];
  // Libellés marchands récents du foyer (voir app/saisie/page.tsx) —
  // proposés en autocomplétion native du navigateur (<datalist>) sur le
  // champ description, pour accélérer la saisie répétée d'un même
  // commerçant sans rien imposer (on peut toujours taper autre chose).
  recentMerchants?: string[];
  onSuccess?: () => void;
  // Pré-remplissage ponctuel (ex: depuis le scan de reçu, voir
  // ReceiptScanPanel.tsx) — un objet différent (même par référence) à chaque
  // scan déclenche le useEffect ci-dessous. `onPrefillApplied` prévient
  // l'appelant une fois consommé, pour qu'il vide son propre état.
  prefill?: TransactionFormPrefill | null;
  onPrefillApplied?: () => void;
}

export default function TransactionForm({
  categories,
  accounts = [],
  recentMerchants = [],
  onSuccess,
  prefill,
  onPrefillApplied,
}: TransactionFormProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'expense',
    categoryId: categories[0]?.id || '',
    subCategory: '',
    paymentMethod: 'Carte Bancaire',
    amount: '',
    notes: '',
    accountId: accounts[0]?.id || '',
  });

  const [loading, setLoading] = useState(false);

  // Budget sécuritaire du jour (voir lib/billCalendar.ts) — chargé une fois
  // au montage depuis la version allégée de l'API calendrier, uniquement
  // pour avertir (jamais bloquer) si la dépense en cours de saisie dépasse
  // ce qui reste du jour. Reste `null` si la fonctionnalité Calendrier est
  // désactivée ou si l'appel échoue : aucun avertissement n'est alors
  // affiché, silencieusement.
  const [todayBudget, setTodayBudget] = useState<{ remainingTodayMad: number } | null>(null);

  const loadTodayBudget = useCallback(() => {
    fetch('/api/calendar/today')
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (result?.success) {
          setTodayBudget({ remainingTodayMad: result.data.remainingTodayMad });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadTodayBudget();
  }, [loadTodayBudget]);

  const amountNum = Number(formData.amount);
  const overBudgetToday =
    todayBudget !== null &&
    formData.type === 'expense' &&
    amountNum > 0 &&
    amountNum > todayBudget.remainingTodayMad;

  useEffect(() => {
    if (!prefill) return;
    // setState différé dans un microtask plutôt qu'appelé de façon
    // synchrone dans le corps de l'effect (règle react-hooks/set-state-in-effect,
    // voir app/household/accept/page.tsx pour le même motif).
    Promise.resolve().then(() => {
      const matchedCategory = prefill.categoryId ? categories.find((c) => c.id === prefill.categoryId) : undefined;
      setFormData((prev) => ({
        ...prev,
        date: prefill.date || prev.date,
        type: matchedCategory?.type || prev.type,
        categoryId: matchedCategory?.id || prev.categoryId,
        subCategory: prefill.subCategory ?? prev.subCategory,
        amount: prefill.amount ?? prev.amount,
        notes: prefill.notes ?? prev.notes,
      }));
      onPrefillApplied?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  // L'"Enveloppe Master" doit rester cohérente avec le Type sélectionné —
  // sinon on peut enregistrer un Revenu sur une catégorie de type "expense",
  // et comme le badge "Sens" dans Historique & Audit se base sur
  // `category.type` (et non sur le Type du formulaire, qui n'est même pas
  // stocké sur la Transaction), la transaction s'affichait comme une
  // Dépense malgré un montant positif.
  const categoriesForType = categories.filter((cat) => cat.type === formData.type);

  // Sous-catégories fournies directement par le serveur (via la prop
  // `categories`) plutôt que fetchées côté client : évite un flash entre le
  // rendu SSR et le premier rendu client (et le mismatch d'hydratation que
  // ça provoquait sur l'attribut `disabled` de ce select).
  const availableSubCategories = categories.find((cat) => cat.id === formData.categoryId)?.subCategories ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setFormData({
          ...formData,
          amount: '',
          notes: '',
          subCategory: '',
        });
        router.refresh();
        loadTodayBudget();
        if (onSuccess) onSuccess();
      }
    } catch (error) {
      console.error('Submit Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-line p-6 mb-8 shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
          <Plus className="w-5 h-5 text-emerald-500" />
        </div>
        <h2 className="text-lg font-bold text-ink tracking-tight">{t('historique.newEntry')}</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-subtle tracking-widest ml-1">{t('common.date')}</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="bg-page border border-line text-body rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm"
              required
            />
          </div>

          {accounts.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-subtle tracking-widest ml-1">{t('form.account')}</label>
              <select
                value={formData.accountId}
                onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                className="bg-page border border-line text-body rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-subtle tracking-widest ml-1">{t('historique.type')}</label>
            <select
              value={formData.type}
              onChange={(e) => {
                const nextType = e.target.value;
                const firstMatch = categories.find((cat) => cat.type === nextType);
                setFormData({ ...formData, type: nextType, categoryId: firstMatch?.id || '', subCategory: '' });
              }}
              className="bg-page border border-line text-body rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm"
            >
              <option value="expense">{t('form.typeExpense')}</option>
              <option value="income">{t('form.typeIncome')}</option>
              <option value="savings">{t('form.typeSavings')}</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-subtle tracking-widest ml-1">{t('historique.envelope')}</label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value, subCategory: '' })}
              disabled={categoriesForType.length === 0}
              className="bg-page border border-line text-body rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm disabled:opacity-50"
              required
            >
              {categoriesForType.length === 0 && <option value="">{t('form.noCategoryOfType')}</option>}
              {categoriesForType.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-subtle tracking-widest ml-1">{t('common.subcategory')}</label>
            <select
              value={formData.subCategory}
              onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
              disabled={availableSubCategories.length === 0}
              className="bg-page border border-line text-body rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm disabled:opacity-50"
            >
              <option value="">
                {availableSubCategories.length === 0 ? t('form.noSubcategory') : t('form.selectPlaceholder')}
              </option>
              {availableSubCategories.map((sub) => (
                <option key={sub.id} value={sub.name}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-subtle tracking-widest ml-1">{t('historique.paymentMethod')}</label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
              className="bg-page border border-line text-body rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm"
            >
              <option value="Carte Bancaire">{t('payment.bankCard')}</option>
              <option value="Virement Bancaire">{t('payment.bankTransfer')}</option>
              <option value="Espèces">{t('payment.cash')}</option>
              <option value="Chèque">{t('payment.check')}</option>
              <option value="CIH Pay/Mobile">{t('payment.cihPay')}</option>
              <option value="PayPal">{t('payment.paypal')}</option>
              <option value="Apple Pay">{t('payment.applePay')}</option>
              <option value="BMCE DIRECT">{t('payment.bmceDirect')}</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-subtle tracking-widest ml-1">{t('form.amount')}</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="bg-page border border-line text-body rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm font-bold"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-[10px] uppercase font-bold text-subtle tracking-widest ml-1">{t('historique.notes')}</label>
            <input
              type="text"
              list="merchant-suggestions"
              placeholder={t('form.notesPlaceholder')}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="bg-page border border-line text-body rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm"
            />
            {recentMerchants.length > 0 && (
              <datalist id="merchant-suggestions">
                {recentMerchants.map((merchant) => (
                  <option key={merchant} value={merchant} />
                ))}
              </datalist>
            )}
          </div>

          <div className="flex flex-col justify-end md:col-start-4">
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50 text-sm h-[42px]"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {t('historique.submit')}
                </>
              )}
            </button>
          </div>
        </div>

        {overBudgetToday && (
          <div className="flex items-center gap-2 p-3 rounded-xl border bg-orange-500/10 border-orange-500/20 text-orange-400 text-[11px] font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {tParams(t('saisie.overBudgetWarning'), { remaining: Math.round(todayBudget?.remainingTodayMad ?? 0) })}
          </div>
        )}
      </form>
    </div>
  );
}
