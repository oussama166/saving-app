'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { KeyRound, Copy, Check, RefreshCw, Trash2, Loader2, QrCode, ClipboardCopy } from 'lucide-react';

const APPLE_PAY_ENDPOINT_HINT = '/api/webhook/apple-pay';
const SALARY_ENDPOINT_HINT = '/api/webhook/salary';

function bearerValue(token: string) {
  return `Bearer ${token}`;
}

export default function WebhookTokenCard() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedHeader, setCopiedHeader] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings/webhook-token')
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setToken(result.data.webhookToken);
      })
      .catch((err) => console.error('Webhook token fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  // Le QR encode toujours la valeur courante du header : si le token change
  // (régénéré/révoqué), on invalide le QR affiché — synchronisé pendant le
  // rendu plutôt que dans un effect pour éviter les rendus en cascade.
  const [lastToken, setLastToken] = useState(token);
  if (token !== lastToken) {
    setLastToken(token);
    if (showQr) setShowQr(false);
    if (qrDataUrl) setQrDataUrl(null);
  }

  const handleGenerate = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/settings/webhook-token', { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        setToken(result.data.webhookToken);
        setRevealed(true);
      }
    } catch (err) {
      console.error('Webhook token generate error:', err);
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/settings/webhook-token', { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        setToken(null);
        setRevealed(false);
      }
    } catch (err) {
      console.error('Webhook token revoke error:', err);
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard copy error:', err);
    }
  };

  const handleCopyHeader = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(bearerValue(token));
      setCopiedHeader(true);
      setTimeout(() => setCopiedHeader(false), 2000);
    } catch (err) {
      console.error('Clipboard copy error:', err);
    }
  };

  const handleToggleQr = async () => {
    if (!token) return;
    if (showQr) {
      setShowQr(false);
      return;
    }
    setQrError(null);
    try {
      if (!qrDataUrl) {
        const dataUrl = await QRCode.toDataURL(bearerValue(token), {
          margin: 1,
          width: 220,
        });
        setQrDataUrl(dataUrl);
      }
      setShowQr(true);
    } catch (err) {
      console.error('QR generation error:', err);
      setQrError('Impossible de générer le QR code.');
    }
  };

  return (
    <div className="p-6 border bg-surface rounded-2xl border-line space-y-4">
      <div className="flex items-center gap-4">
        <div className="p-3 border bg-purple-600/20 rounded-xl border-purple-500/20">
          <KeyRound className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h2 className="text-sm font-black tracking-tight uppercase text-ink">
            Token Webhook (iOS Shortcut)
          </h2>
          <p className="text-subtle text-xs mt-0.5 max-w-md">
            Génère un token pour connecter un iOS Shortcut Apple Pay ou Salaire
            directement à ton compte, sans passer par ta session navigateur.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement...
        </div>
      ) : token ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-mono text-body-soft truncate">
              {revealed ? token : '•'.repeat(20)}
            </code>
            <button
              onClick={() => setRevealed((v) => !v)}
              className="px-3 py-2.5 text-xs font-medium border rounded-xl border-line text-body-soft hover:bg-surface-alt transition-colors whitespace-nowrap"
            >
              {revealed ? 'Masquer' : 'Afficher'}
            </button>
            <button
              onClick={handleCopy}
              className="p-2.5 border rounded-xl border-line text-body-soft hover:bg-surface-alt transition-colors"
              title="Copier le token brut"
              aria-label="Copier le token"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCopyHeader}
              className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-purple-400 border rounded-xl border-purple-500/20 bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
              title="Copie « Bearer <token> », prêt à coller dans le champ Value du header Authorization"
            >
              {copiedHeader ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
              {copiedHeader ? 'Copié !' : 'Copier pour le header'}
            </button>
            <button
              onClick={handleToggleQr}
              className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-purple-400 border rounded-xl border-purple-500/20 bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
            >
              <QrCode className="w-3.5 h-3.5" />
              {showQr ? 'Masquer le QR code' : 'QR code'}
            </button>
          </div>

          {qrError && <p className="text-[11px] text-red-400">{qrError}</p>}

          {showQr && qrDataUrl && (
            <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR code du header Authorization" width={220} height={220} />
              <p className="text-[11px] text-neutral-500 text-center max-w-[220px]">
                Scanne avec l&apos;iPhone (Appareil photo ou action « Scan QR Code ») : le contenu est directement
                « Bearer &lt;token&gt; », prêt à coller dans le champ Value du header Authorization.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleGenerate}
              disabled={busy}
              className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-blue-400 border rounded-xl border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Régénérer
            </button>
            <button
              onClick={handleRevoke}
              disabled={busy}
              className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-400 border rounded-xl border-red-500/20 bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Révoquer
            </button>
          </div>

          <div className="text-[11px] text-faint leading-relaxed border-t border-line-subtle pt-3 space-y-2">
            <p>
              Dans le Shortcut iOS, ajoute un header <code className="text-body-soft">Authorization: Bearer &lt;token&gt;</code>{' '}
              et envoie une requête POST vers <code className="text-body-soft">{APPLE_PAY_ENDPOINT_HINT}</code> (dépenses) ou{' '}
              <code className="text-body-soft">{SALARY_ENDPOINT_HINT}</code> (salaire). Utilise « Copier pour le header »
              ou le QR code ci-dessus pour remplir directement le champ Value — pas besoin de retaper « Bearer » à la
              main. Régénérer le token invalide immédiatement l&apos;ancien.
            </p>
            <p>
              Pour la catégorisation automatique par position : ajoute une action{' '}
              <span className="text-body-soft">Get Details of Location</span> (Latitude puis Longitude séparément) et
              inclus-les dans le corps JSON sous <code className="text-body-soft">latitude</code> et{' '}
              <code className="text-body-soft">longitude</code> (nombres, pas le texte brut de la variable{' '}
              <span className="text-body-soft">Location</span>). Sans ces deux champs, la transaction reste
              simplement dans &quot;Uncategorized&quot; comme avant.
            </p>
          </div>
        </div>
      ) : (
        <button
          onClick={handleGenerate}
          disabled={busy}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          Générer un token
        </button>
      )}
    </div>
  );
}
