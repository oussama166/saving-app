'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, AlertTriangle, Check, X } from 'lucide-react';
import type { TransactionFormPrefill } from './TransactionForm';

interface ScannedReceipt {
  merchant: string;
  amount: number;
  date: string;
  categoryId: string | null;
  categoryName: string | null;
  subCategory: string | null;
  detectedCurrency: string | null;
  lowConfidence: boolean;
}

interface ReceiptScanPanelProps {
  onUse: (prefill: TransactionFormPrefill) => void;
}

// Lit un File en base64 SANS le préfixe "data:image/...;base64," (l'API
// attend juste les octets encodés, le mediaType est envoyé séparément).
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ReceiptScanPanel({ onUse }: ReceiptScanPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScannedReceipt | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setResult(null);
    setPreviewUrl(URL.createObjectURL(file));
    setScanning(true);
    try {
      const base64 = await readFileAsBase64(file);
      const res = await fetch('/api/transactions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: file.type }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Échec de la lecture du reçu');
        return;
      }
      setResult(json.data);
    } catch (err) {
      console.error('Receipt scan error:', err);
      setError('Erreur réseau');
    } finally {
      setScanning(false);
    }
  };

  const handleUse = () => {
    if (!result) return;
    onUse({
      date: result.date,
      categoryId: result.categoryId ?? undefined,
      subCategory: result.subCategory ?? undefined,
      amount: String(result.amount),
      notes: result.merchant,
    });
    reset();
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-surface rounded-xl border border-line p-6 mb-8 shadow-xl space-y-4">
      <div className="flex items-center gap-3">
        <div className="bg-purple-500/10 p-2 rounded-lg border border-purple-500/20">
          <Camera className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-ink tracking-tight">Scanner un reçu</h2>
          <p className="text-[11px] text-subtle">Photo d&apos;un ticket de caisse → champs pré-remplis à relire avant validation.</p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {!previewUrl && !scanning && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-line hover:border-purple-500/50 hover:bg-purple-500/5 rounded-xl py-8 text-sm font-semibold text-subtle hover:text-purple-400 transition-colors"
        >
          <Camera className="w-5 h-5" />
          Prendre ou choisir une photo
        </button>
      )}

      {previewUrl && (
        <div className="flex gap-4 items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Reçu scanné" className="w-24 h-24 object-cover rounded-lg border border-line shrink-0" />
          <div className="flex-1 min-w-0 space-y-3">
            {scanning && (
              <div className="flex items-center gap-2 text-sm text-subtle">
                <Loader2 className="w-4 h-4 animate-spin" />
                Lecture du reçu...
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
                {error}
              </div>
            )}

            {result && (
              <div className="space-y-2">
                {result.lowConfidence && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex gap-2 text-[12px] text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Lecture incertaine (reçu flou, ou catégorie non reconnue) — vérifie bien chaque champ avant de valider.
                  </div>
                )}
                <div className="text-sm text-body-soft">
                  <strong className="text-ink">{result.merchant}</strong> — {result.amount.toLocaleString('fr-FR')}{' '}
                  {result.detectedCurrency || ''}
                  <span className="text-subtle"> · {result.date}</span>
                  {result.categoryName && <span className="text-subtle"> · {result.categoryName}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleUse}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Utiliser ces infos
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
          </div>
        </div>
      )}
    </div>
  );
}
