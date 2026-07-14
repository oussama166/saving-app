'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Stethoscope, PlusCircle, Check, FileCheck2 } from 'lucide-react';

export interface MedicalRecordRow {
  id: string;
  provider: string;
  amount: number;
  date: string;
  reimbursementStatus: string;
  transaction: { id: string; merchant: string; amount: number } | null;
}

const EMPTY_FORM = {
  provider: '',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  linkTransaction: true,
};

const STATUS_FLOW = ['PENDING', 'SUBMITTED', 'REIMBURSED'] as const;

const STATUS_META: Record<string, { label: string; color: string; nextLabel: string }> = {
  PENDING: {
    label: 'En attente',
    color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    nextLabel: 'Soumettre à la CNSS',
  },
  SUBMITTED: {
    label: 'Soumis CNSS',
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    nextLabel: 'Marquer remboursé',
  },
  REIMBURSED: {
    label: 'Remboursé',
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    nextLabel: '',
  },
};

export default function MedicalRecordsTable({ records }: { records: MedicalRecordRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const formatDH = (amt: number) =>
    new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amt).replace('MAD', 'DH');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: form.provider,
          amount: form.amount,
          date: form.date,
          linkTransaction: form.linkTransaction,
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

  const handleCnssUpdate = async (record: MedicalRecordRow) => {
    const currentIdx = STATUS_FLOW.indexOf(record.reimbursementStatus as (typeof STATUS_FLOW)[number]);
    const next = STATUS_FLOW[currentIdx + 1];
    if (!next) return;

    setUpdatingId(record.id);
    try {
      await fetch(`/api/health/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reimbursementStatus: next }),
      });
      router.refresh();
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#1b253b] rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-white">Historique des Soins</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="text-slate-500 bg-slate-900/50">
                <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">Date</th>
                <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">Prestataire</th>
                <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">Montant</th>
                <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">
                  Transaction Liée
                </th>
                <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">Statut</th>
                <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800 text-right">
                  Dossier CNSS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {records.map((record) => {
                const status = STATUS_META[record.reimbursementStatus] ?? STATUS_META.PENDING;
                const isFinal = record.reimbursementStatus === 'REIMBURSED';

                return (
                  <tr key={record.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-5 text-slate-400">
                      {new Date(record.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3 px-5 font-bold text-slate-200">{record.provider}</td>
                    <td className="py-3 px-5 text-slate-400">{formatDH(record.amount)}</td>
                    <td className="py-3 px-5 text-slate-500">
                      {record.transaction ? (
                        <span className="text-[10px] text-emerald-400">✓ Liée</span>
                      ) : (
                        <span className="text-[10px] text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right">
                      {isFinal ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                          <FileCheck2 className="w-3.5 h-3.5" />
                          Dossier clos
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCnssUpdate(record)}
                          disabled={updatingId === record.id}
                          className="text-[10px] font-bold bg-slate-800 hover:bg-rose-600/20 text-slate-300 hover:text-rose-400 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
                        >
                          {updatingId === record.id ? '...' : status.nextLabel}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {records.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500 italic">
                    Aucun soin enregistré pour le moment. Ajoute le premier ci-dessous.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Form */}
      <div className="bg-[#1b253b] rounded-xl border border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
            <PlusCircle className="w-5 h-5 text-rose-400" />
          </div>
          <h3 className="text-lg font-bold text-white tracking-tight">Enregistrer un Soin</h3>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Prestataire</label>
            <input
              type="text"
              placeholder="Ex: Dr. Bennani, Pharmacie Centrale"
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
              className="bg-[#131b2c] border border-slate-700 text-slate-200 rounded-lg p-2.5 focus:border-rose-500 outline-none transition-colors text-sm"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">
              Montant (DH)
            </label>
            <input
              type="number"
              step="any"
              placeholder="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="bg-[#131b2c] border border-slate-700 text-slate-200 rounded-lg p-2.5 focus:border-rose-500 outline-none transition-colors text-sm"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="bg-[#131b2c] border border-slate-700 text-slate-200 rounded-lg p-2.5 focus:border-rose-500 outline-none transition-colors text-sm"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5 justify-end">
            <label className="flex items-center gap-2 text-[11px] text-slate-400 py-2.5">
              <input
                type="checkbox"
                checked={form.linkTransaction}
                onChange={(e) => setForm({ ...form, linkTransaction: e.target.checked })}
                className="accent-rose-500 w-4 h-4"
              />
              Créer la transaction liée
            </label>
          </div>

          <div className="flex gap-3 md:col-span-5">
            <button
              type="submit"
              disabled={loading}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 px-6 rounded-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50 text-sm"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Ajouter
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
