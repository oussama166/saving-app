'use client';

import { useEffect, useState } from 'react';
import { SlidersHorizontal, FileSpreadsheet, Loader2, Download } from 'lucide-react';
import ProfileAllocationEditor, { AllocationRow } from '../components/ProfileAllocationEditor';
import RealBudgetOptimizer from '../components/RealBudgetOptimizer';

export default function ProfilPage() {
  const [referenceIncome, setReferenceIncome] = useState(10000);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generatingBilan, setGeneratingBilan] = useState(false);
  const [bilanError, setBilanError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setReferenceIncome(result.data.referenceIncome);
          setAllocations(
            result.data.categories.map((c: { id: string; name: string; budgetPct: number }) => ({
              id: c.id,
              name: c.name,
              budgetPct: c.budgetPct,
            })),
          );
          setUpdatedAt(result.data.updatedAt);
        }
      })
      .catch((err) => console.error('Settings fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleAllocationChange = (id: string, pct: number) => {
    setSaved(false);
    setAllocations((prev) => prev.map((a) => (a.id === id ? { ...a, budgetPct: pct } : a)));
  };

  const handleApplyReal = (realAllocations: { id: string; budgetPct: number }[]) => {
    setSaved(false);
    setAllocations((prev) =>
      prev.map((a) => {
        const match = realAllocations.find((r) => r.id === a.id);
        return match ? { ...a, budgetPct: match.budgetPct } : a;
      }),
    );
  };

  const handleGenerateBilan = async () => {
    setGeneratingBilan(true);
    setBilanError(null);
    try {
      const res = await fetch('/api/reports/bilan');
      if (!res.ok) {
        throw new Error('Échec de la génération du bilan');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `bilan-financier-${today}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Bilan generation error:', err);
      setBilanError('Impossible de générer le bilan. Réessayez.');
    } finally {
      setGeneratingBilan(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceIncome,
          allocations: allocations.map((a) => ({ id: a.id, budgetPct: a.budgetPct })),
        }),
      });
      const result = await res.json();
      if (result.success) {
        setSaved(true);
        setUpdatedAt(new Date().toISOString());
      }
    } catch (err) {
      console.error('Settings save error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#131b2c] p-8 text-slate-200 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="bg-[#1b253b] rounded-2xl border border-slate-700 p-6 flex items-center gap-4">
          <div className="bg-blue-600/20 p-3 rounded-xl border border-blue-500/20">
            <SlidersHorizontal className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white uppercase">
              Paramétrage &amp; Profil Intelligent
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Adaptez la théorie financière du 50/30/20 à la réalité concrète de votre vie à Tanger.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <ProfileAllocationEditor
              referenceIncome={referenceIncome}
              onReferenceIncomeChange={(v) => {
                setSaved(false);
                setReferenceIncome(v);
              }}
              allocations={allocations}
              onAllocationChange={handleAllocationChange}
              onSave={handleSave}
              saving={saving}
              saved={saved}
            />
            <RealBudgetOptimizer onApply={handleApplyReal} />
          </div>
        )}

        <div className="bg-[#1b253b] rounded-2xl border border-slate-700 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-600/20 p-3 rounded-xl border border-emerald-500/20">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-white uppercase">
                Générateur de Bilan Excel
              </h2>
              <p className="text-slate-500 text-xs mt-0.5 max-w-md">
                Export .xlsx complet : résumé mensuel &amp; budget, historique de toutes les transactions,
                et patrimoine (portefeuille, objectifs, fonds d&apos;urgence).
              </p>
              {bilanError && <p className="text-red-400 text-xs mt-1">{bilanError}</p>}
            </div>
          </div>
          <button
            onClick={handleGenerateBilan}
            disabled={generatingBilan}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            {generatingBilan ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Génération...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Télécharger le bilan
              </>
            )}
          </button>
        </div>

        <p className="text-center text-[11px] text-slate-600 pt-4">
          Système conçu pour Tanger, Maroc · Règle 50/30/20 enrichie
          {updatedAt && ` · Dernière mise à jour : ${new Date(updatedAt).toLocaleDateString('fr-FR')}`}
        </p>
      </div>
    </main>
  );
}
