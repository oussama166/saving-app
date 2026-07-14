'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, TrendingDown, Pencil, Trash2, Check, PlusCircle } from 'lucide-react';

export interface EnrichedPortfolioAsset {
  id: string;
  tickerSymbol: string;
  assetType: string;
  sharesOwned: number;
  averageBuyPrice: number;
  manualPrice: number | null;
  livePrice: number;
  liveValue: number;
  profitAmount: number;
  profitPercentage: number;
}

interface Props {
  assets: EnrichedPortfolioAsset[];
  globalLiveValue: number;
  globalCostBasis: number;
  globalProfit: number;
}

const ASSET_TYPE_OPTIONS = [
  { value: 'Action', label: 'Action MASI' },
  { value: 'ETF', label: 'ETF' },
  { value: 'Crypto', label: 'Crypto' },
  { value: 'OPCVM', label: 'OPCVM' },
  { value: 'Or', label: 'Or/Métaux' },
];

const EMPTY_FORM = {
  id: '',
  name: '',
  assetType: 'Action',
  sharesOwned: '',
  averageBuyPrice: '',
  manualPrice: '',
};

export default function PortfolioAssetsTable({ assets, globalLiveValue, globalCostBasis, globalProfit }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);

  const formatDH = (amt: number) =>
    new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amt).replace('MAD', 'DH');

  const globalReturnPct = globalCostBasis !== 0 ? (globalProfit / globalCostBasis) * 100 : 0;

  const handleEdit = (asset: EnrichedPortfolioAsset) => {
    setForm({
      id: asset.id,
      name: asset.tickerSymbol,
      assetType: asset.assetType,
      sharesOwned: String(asset.sharesOwned),
      averageBuyPrice: String(asset.averageBuyPrice),
      manualPrice: asset.manualPrice != null ? String(asset.manualPrice) : '',
    });
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cet actif du portfolio ?')) return;
    await fetch(`/api/portfolio/asset/${id}`, { method: 'DELETE' });
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/portfolio/asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id || undefined,
          name: form.name,
          assetType: form.assetType,
          sharesOwned: form.sharesOwned,
          averageBuyPrice: form.averageBuyPrice,
          manualPrice: form.manualPrice || null,
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
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            Valeur Totale Portfolio
          </span>
          <p className="text-xl font-bold text-slate-200 mt-1">{formatDH(globalLiveValue)}</p>
        </div>
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            Plus-value Latente
          </span>
          <p className={`text-xl font-bold mt-1 ${globalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {globalProfit >= 0 ? '+' : ''}
            {formatDH(globalProfit)}
          </p>
        </div>
        <div className="bg-blue-600/10 p-4 rounded-xl border border-blue-500/20">
          <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">
            Rendement Global
          </span>
          <p className={`text-2xl font-black mt-1 ${globalReturnPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {globalReturnPct >= 0 ? '+' : ''}
            {globalReturnPct.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Assets Table */}
      <div className="bg-[#1b253b] rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-white">Vos Actifs Financiers</h3>
          <span className="text-[10px] text-slate-500 ml-auto italic">
            * Les prix peuvent être mis à jour manuellement
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="text-slate-500 bg-slate-900/50">
                <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">Actif</th>
                <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">Type</th>
                <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">Quantité</th>
                <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">
                  Prix Achat
                </th>
                <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">
                  Prix Actuel
                </th>
                <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">Valeur</th>
                <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">
                  Rendement
                </th>
                <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {assets.map((asset) => (
                <tr key={asset.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="py-3 px-5 font-bold text-slate-200">{asset.tickerSymbol}</td>
                  <td className="py-3 px-5 text-slate-400">{asset.assetType}</td>
                  <td className="py-3 px-5 text-slate-400">{asset.sharesOwned}</td>
                  <td className="py-3 px-5 text-slate-400">{formatDH(asset.averageBuyPrice)}</td>
                  <td className="py-3 px-5 text-slate-400">{formatDH(asset.livePrice)}</td>
                  <td className="py-3 px-5 font-bold text-slate-200">{formatDH(asset.liveValue)}</td>
                  <td
                    className={`py-3 px-5 font-bold flex items-center gap-1 ${
                      asset.profitPercentage >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {asset.profitPercentage >= 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {asset.profitPercentage >= 0 ? '+' : ''}
                    {asset.profitPercentage.toFixed(2)}%
                  </td>
                  <td className="py-3 px-5">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(asset)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600/20 text-slate-400 hover:text-blue-400 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(asset.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-600/20 text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {assets.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500 italic">
                    Aucun actif enregistré. Ajoute ta première position ci-dessous.
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
            {form.id ? "Modifier l'actif" : 'Ajouter ou mettre à jour un actif'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">
              Nom de l&apos;actif
            </label>
            <input
              type="text"
              placeholder="Ex: Itissalat..."
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-[#131b2c] border border-slate-700 text-slate-200 rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Type</label>
            <select
              value={form.assetType}
              onChange={(e) => setForm({ ...form, assetType: e.target.value })}
              className="bg-[#131b2c] border border-slate-700 text-slate-200 rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm"
            >
              {ASSET_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Quantité</label>
            <input
              type="number"
              step="any"
              placeholder="0"
              value={form.sharesOwned}
              onChange={(e) => setForm({ ...form, sharesOwned: e.target.value })}
              className="bg-[#131b2c] border border-slate-700 text-slate-200 rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">
              Prix Achat
            </label>
            <input
              type="number"
              step="any"
              placeholder="DH"
              value={form.averageBuyPrice}
              onChange={(e) => setForm({ ...form, averageBuyPrice: e.target.value })}
              className="bg-[#131b2c] border border-slate-700 text-slate-200 rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">
              Prix Actuel
            </label>
            <input
              type="number"
              step="any"
              placeholder="DH (optionnel)"
              value={form.manualPrice}
              onChange={(e) => setForm({ ...form, manualPrice: e.target.value })}
              className="bg-[#131b2c] border border-slate-700 text-slate-200 rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm"
            />
          </div>

          <div className="flex flex-col justify-end gap-1.5 md:col-span-6">
            <p className="text-[10px] text-slate-500 mb-1">
              Laisse &quot;Prix Actuel&quot; vide pour laisser l&apos;app essayer une cotation automatique (utile
              pour Crypto/ETF cotés à l&apos;international) — sinon le prix saisi ici fait foi (recommandé pour
              Action MASI, OPCVM, Or).
            </p>
            <div className="flex gap-3">
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
          </div>
        </form>
      </div>
    </div>
  );
}
