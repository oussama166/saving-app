'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Check } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  type: string;
}

interface SubCategory {
  id: string;
  name: string;
}

interface CategoryWithSubs extends Category {
  subCategories: SubCategory[];
}

interface TransactionFormProps {
  categories: Category[];
  onSuccess?: () => void;
}

export default function TransactionForm({ categories, onSuccess }: TransactionFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'expense',
    categoryId: categories[0]?.id || '',
    subCategory: '',
    paymentMethod: 'Carte Bancaire',
    amount: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [categoriesWithSubs, setCategoriesWithSubs] = useState<CategoryWithSubs[]>([]);

  // Charge les sous-catégories (dépendantes de la catégorie choisie) une
  // seule fois au montage — alimente le dropdown "Sous-catégorie" ci-dessous.
  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setCategoriesWithSubs(data.data);
      })
      .catch((error) => console.error('Failed to load categories:', error));
  }, []);

  const availableSubCategories =
    categoriesWithSubs.find((cat) => cat.id === formData.categoryId)?.subCategories ?? [];

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
        if (onSuccess) onSuccess();
      }
    } catch (error) {
      console.error('Submit Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#1b253b] rounded-xl border border-slate-700 p-6 mb-8 shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
          <Plus className="w-5 h-5 text-emerald-500" />
        </div>
        <h2 className="text-lg font-bold text-white tracking-tight">Nouvel Enregistrement</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="bg-[#131b2c] border border-slate-700 text-slate-200 rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="bg-[#131b2c] border border-slate-700 text-slate-200 rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm"
            >
              <option value="expense">Dépense (-)</option>
              <option value="income">Revenu (+)</option>
              <option value="Épargne/Invest.">Épargne / Invest.</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Enveloppe Master</label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value, subCategory: '' })}
              className="bg-[#131b2c] border border-slate-700 text-slate-200 rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm"
              required
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Sous-catégorie</label>
            <select
              value={formData.subCategory}
              onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
              disabled={availableSubCategories.length === 0}
              className="bg-[#131b2c] border border-slate-700 text-slate-200 rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm disabled:opacity-50"
            >
              <option value="">
                {availableSubCategories.length === 0 ? 'Aucune sous-catégorie' : 'Sélectionner...'}
              </option>
              {availableSubCategories.map((sub) => (
                <option key={sub.id} value={sub.name}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Méthode de Paiement</label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
              className="bg-[#131b2c] border border-slate-700 text-slate-200 rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm"
            >
              <option value="Carte Bancaire">Carte Bancaire</option>
              <option value="Virement Bancaire">Virement Bancaire</option>
              <option value="Espèces">Espèces</option>
              <option value="Chèque">Chèque</option>
              <option value="CIH Pay/Mobile">CIH Pay/Mobile</option>
              <option value="PayPal">PayPal</option>
              <option value="Apple Pay">Apple Pay</option>
              <option value="BMCE DIRECT">BMCE DIRECT</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Montant (DH)</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="bg-[#131b2c] border border-slate-700 text-slate-200 rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm font-bold"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Notes / Référence</label>
            <input
              type="text"
              placeholder="Description de la transaction..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="bg-[#131b2c] border border-slate-700 text-slate-200 rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm"
            />
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
                  Valider Flux
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
