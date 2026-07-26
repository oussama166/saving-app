'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Loader2, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Check, X } from 'lucide-react';
import type { CsvColumnMapping } from '@/lib/csvImport';

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

interface PreviewData {
  headerCells: string[];
  headerRecognized: boolean;
  previewRows: string[][];
  headerSignature: string;
  mapping: CsvColumnMapping;
  fromSavedProfile: boolean;
  savedProfileLabel: string | null;
}

const COLUMN_ROLES = [
  { key: 'dateIdx', label: 'Date' },
  { key: 'merchantIdx', label: 'Libellé' },
  { key: 'amountIdx', label: 'Montant (signé)' },
  { key: 'debitIdx', label: 'Débit' },
  { key: 'creditIdx', label: 'Crédit' },
] as const;

// Beaucoup d'exports bancaires marocains (surtout les plus anciens) sont
// encodés en Windows-1252 / ISO-8859-1, pas en UTF-8 — les libellés
// accentués ("Libellé", "Débit", "Crédit"...) deviennent alors illisibles
// (mojibake) si on lit le fichier en UTF-8 par défaut, ce qui casse la
// reconnaissance des en-têtes côté serveur. On tente d'abord un décodage
// UTF-8 strict ; s'il échoue ou produit des caractères de remplacement
// (U+FFFD), on retente en Windows-1252.
async function readCsvFileAsText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (!utf8.includes('�')) return utf8;
  } catch {
    // Pas de l'UTF-8 valide — on retente ci-dessous.
  }
  return new TextDecoder('windows-1252').decode(bytes);
}

export default function CsvImportPanel({ accounts }: { accounts: OptionItem[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [mapping, setMapping] = useState<CsvColumnMapping | null>(null);
  const [saveProfile, setSaveProfile] = useState(true);
  const [bankLabel, setBankLabel] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const reset = () => {
    setCsvText(null);
    setPreview(null);
    setMapping(null);
    setSummary(null);
    setErrors([]);
    setGlobalError(null);
    setBankLabel('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    setGlobalError(null);
    setSummary(null);
    setErrors([]);
    setPreview(null);
    setFileName(file.name);
    try {
      const csv = await readCsvFileAsText(file);
      setCsvText(csv);
      const res = await fetch('/api/transactions/csv-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      });
      const result = await res.json();
      if (!result.success) {
        setGlobalError(result.error || "Erreur lors de l'analyse du fichier");
        return;
      }
      setPreview(result.data);
      setMapping(result.data.mapping);
    } catch (err) {
      console.error('CSV preview error:', err);
      setGlobalError('Erreur réseau');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!csvText || !mapping || !preview) return;
    setBusy(true);
    setGlobalError(null);
    try {
      const res = await fetch('/api/transactions/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv: csvText,
          accountId: accountId || undefined,
          mapping,
          headerSignature: preview.headerSignature,
          saveProfile: saveProfile && !preview.fromSavedProfile,
          bankLabel: bankLabel || undefined,
        }),
      });
      const result = await res.json();
      if (!result.success) {
        setGlobalError(result.error || "Erreur lors de l'import");
        return;
      }
      setSummary(result.summary);
      setErrors(result.errors ?? []);
      setPreview(null);
      if (result.summary.imported > 0) {
        router.refresh();
      }
    } catch (err) {
      console.error('CSV import error:', err);
      setGlobalError('Erreur réseau');
    } finally {
      setBusy(false);
    }
  };

  const updateMappingField = (key: (typeof COLUMN_ROLES)[number]['key'], value: string) => {
    if (!mapping) return;
    const idx = value === '' ? -1 : Number(value);
    setMapping({ ...mapping, [key]: idx });
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
            Chaque banque exporte son CSV différemment (colonnes, délimiteur, ordre) — le format est détecté
            automatiquement à l&apos;étape suivante, avec un aperçu à corriger si besoin. Une fois validé, ce format est
            mémorisé : les prochains imports du même relevé n&apos;auront plus besoin de correction.
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

          {preview && mapping && (
            <div className="p-4 rounded-xl border border-line bg-surface-alt/50 space-y-3">
              {preview.fromSavedProfile ? (
                <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Format reconnu{preview.savedProfileLabel ? ` (${preview.savedProfileLabel})` : ''} — mapping repris
                  automatiquement.
                </p>
              ) : (
                <p className="text-xs text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {preview.headerRecognized
                    ? 'Format détecté — vérifie que chaque colonne correspond bien avant de confirmer.'
                    : "En-têtes non reconnus, ordre par défaut supposé (Date, Libellé, Montant) — corrige si besoin."}
                </p>
              )}

              <div className="overflow-x-auto">
                <table className="text-xs w-full border-collapse">
                  <thead>
                    <tr>
                      {preview.previewRows[0]?.map((_, colIdx) => (
                        <th key={colIdx} className="text-left p-1.5 border-b border-line font-bold text-subtle">
                          {preview.headerCells[colIdx] || `Colonne ${colIdx + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.previewRows.map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {row.map((cell, colIdx) => (
                          <td key={colIdx} className="p-1.5 border-b border-line-subtle/50 text-body-soft truncate max-w-[140px]">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {COLUMN_ROLES.map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-subtle">{label}</label>
                    <select
                      value={mapping[key]}
                      onChange={(e) => updateMappingField(key, e.target.value)}
                      className="w-full bg-page border border-line text-body rounded-lg p-2 text-xs outline-none focus:border-blue-500"
                    >
                      <option value="">—</option>
                      {(preview.headerCells.length > 0 ? preview.headerCells : preview.previewRows[0] ?? []).map((h, i) => (
                        <option key={i} value={i}>
                          {preview.headerCells[i] || `Colonne ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {!preview.fromSavedProfile && (
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center pt-2">
                  <label className="flex items-center gap-2 text-xs text-body-soft">
                    <input
                      type="checkbox"
                      checked={saveProfile}
                      onChange={(e) => setSaveProfile(e.target.checked)}
                      className="rounded"
                    />
                    Mémoriser ce format
                  </label>
                  {saveProfile && (
                    <input
                      value={bankLabel}
                      onChange={(e) => setBankLabel(e.target.value)}
                      placeholder="Nom de la banque (optionnel, ex: CIH Bank)"
                      className="flex-1 bg-page border border-line text-body rounded-lg p-2 text-xs outline-none focus:border-blue-500"
                    />
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleConfirmImport}
                  disabled={busy}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Confirmer l&apos;import
                </button>
                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium border rounded-lg border-line text-body-soft hover:bg-surface-alt transition-colors"
                >
                  <X className="w-4 h-4" />
                  Annuler
                </button>
              </div>
            </div>
          )}

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
