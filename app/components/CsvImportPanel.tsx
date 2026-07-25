'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Loader2, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle } from 'lucide-react';

interface OptionItem {
  id: string;
  name: string;
}

interface ImportSummary {
  imported: number;
  duplicatesSkipped: number;
  errorCount: number;
}

interface ImportError {
  line: number;
  message: string;
}

export default function CsvImportPanel({ accounts }: { accounts: OptionItem[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    setGlobalError(null);
    setSummary(null);
    setErrors([]);
    setFileName(file.name);
    try {
      const csv = await file.text();
      const res = await fetch('/api/transactions/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, accountId: accountId || undefined }),
      });
      const result = await res.json();
      if (!result.success) {
        setGlobalError(result.error || "Erreur lors de l'import");
        return;
      }
      setSummary(result.summary);
      setErrors(result.errors ?? []);
      if (result.summary.imported > 0) {
        router.refresh();
      }
    } catch (err) {
      console.error('CSV import error:', err);
      setGlobalError('Erreur réseau');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-6 border bg-surface rounded-2xl border-line space-y-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl border bg-blue-600/10 border-blue-500/20">
            <Upload className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight uppercase text-ink">
              Importer un relevé bancaire (CSV)
            </h2>
            <p className="text-subtle text-xs mt-0.5">
              Alternative aux webhooks iOS — pour Android ou toute banque exportant un CSV.
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
      </button>

      {open && (
        <div className="space-y-4 pt-2 border-t border-line-subtle">
          {globalError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
              {globalError}
            </div>
          )}

          <p className="text-xs text-subtle">
            Colonnes attendues : une date, un libellé/description et un montant (ou débit/crédit séparés) — les
            en-têtes courants (Date, Libellé, Montant, Débit, Crédit...) sont détectés automatiquement. À défaut,
            l&apos;ordre date / libellé / montant est supposé. Les lignes déjà importées (même date, montant et
            libellé) sont ignorées automatiquement.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            {accounts.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Compte</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full sm:w-56 bg-page border border-line text-body rounded-lg p-2.5 focus:border-blue-500 outline-none transition-colors text-sm"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Fichier CSV</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
                className="block text-sm text-body-soft file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 file:cursor-pointer cursor-pointer disabled:opacity-50"
              />
            </div>
            {busy && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
          </div>

          {summary && (
            <div className="p-4 rounded-xl border border-line bg-surface-alt/50 space-y-2">
              <p className="text-sm font-bold text-ink flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {fileName} — {summary.imported} transaction(s) importée(s)
              </p>
              <p className="text-xs text-subtle">
                {summary.duplicatesSkipped} doublon(s) ignoré(s), {summary.errorCount} ligne(s) en erreur.
              </p>
              {errors.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowErrors((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-bold text-amber-400"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {showErrors ? 'Masquer' : 'Voir'} le détail des erreurs
                  </button>
                  {showErrors && (
                    <ul className="mt-2 space-y-1 text-[11px] text-faint max-h-40 overflow-y-auto">
                      {errors.map((e, i) => (
                        <li key={i}>
                          Ligne {e.line} : {e.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
