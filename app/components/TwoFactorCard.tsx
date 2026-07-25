'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff, Loader2, Check, Copy, AlertTriangle } from 'lucide-react';
import PasswordInput from './PasswordInput';

type Step = 'idle' | 'qr' | 'recovery-codes';

export default function TwoFactorCard() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [step, setStep] = useState<Step>('idle');

  // Setup (activation)
  const [secret, setSecret] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState('');
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [codesCopied, setCodesCopied] = useState(false);

  // Désactivation
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableBusy, setDisableBusy] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setEnabled(Boolean(result.user.twoFactorEnabled));
      })
      .catch((err) => console.error('2FA status fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  const startSetup = async () => {
    setSetupError(null);
    setSetupBusy(true);
    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST' });
      const result = await res.json();
      if (!result.success) {
        setSetupError(result.error || 'Erreur lors de la génération du QR code');
        return;
      }
      setSecret(result.secret);
      // Import dynamique : qrcode est déjà une dépendance du projet (voir
      // WebhookTokenCard) — chargé seulement quand ce flux est réellement
      // ouvert plutôt qu'à chaque affichage de la page Profil.
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(result.otpauthUrl, { margin: 1, width: 220 });
      setQrDataUrl(dataUrl);
      setStep('qr');
    } catch (err) {
      console.error('2FA setup error:', err);
      setSetupError('Erreur réseau');
    } finally {
      setSetupBusy(false);
    }
  };

  const confirmSetup = async () => {
    setSetupError(null);
    setSetupBusy(true);
    try {
      const res = await fetch('/api/auth/2fa/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: confirmCode }),
      });
      const result = await res.json();
      if (!result.success) {
        setSetupError(result.error || 'Code incorrect');
        return;
      }
      setRecoveryCodes(result.recoveryCodes);
      setStep('recovery-codes');
      setEnabled(true);
    } catch (err) {
      console.error('2FA confirm error:', err);
      setSetupError('Erreur réseau');
    } finally {
      setSetupBusy(false);
    }
  };

  const finishSetup = () => {
    setStep('idle');
    setSecret(null);
    setQrDataUrl(null);
    setConfirmCode('');
    setRecoveryCodes([]);
    setCodesCopied(false);
  };

  const copyRecoveryCodes = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
      setCodesCopied(true);
      setTimeout(() => setCodesCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard copy error:', err);
    }
  };

  const handleDisable = async () => {
    setDisableError(null);
    if (!disablePassword) {
      setDisableError('Mot de passe requis');
      return;
    }
    setDisableBusy(true);
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disablePassword }),
      });
      const result = await res.json();
      if (!result.success) {
        setDisableError(result.error || 'Erreur lors de la désactivation');
        return;
      }
      setEnabled(false);
      setShowDisableForm(false);
      setDisablePassword('');
    } catch (err) {
      console.error('2FA disable error:', err);
      setDisableError('Erreur réseau');
    } finally {
      setDisableBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 border bg-surface rounded-2xl border-line">
        <div className="flex items-center gap-2 text-xs text-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 border bg-surface rounded-2xl border-line space-y-4">
      <div className="flex items-center gap-4">
        <div className={`p-3 border rounded-xl ${enabled ? 'bg-emerald-600/20 border-emerald-500/20' : 'bg-purple-600/20 border-purple-500/20'}`}>
          {enabled ? (
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          ) : (
            <ShieldOff className="w-6 h-6 text-purple-400" />
          )}
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-black tracking-tight uppercase text-ink">
            Authentification à deux facteurs
          </h2>
          <p className="text-subtle text-xs mt-0.5">
            {enabled
              ? 'Activée — un code de ton app d\'authentification est demandé à chaque connexion.'
              : 'Ajoute une couche de sécurité : un code à 6 chiffres en plus du mot de passe à la connexion.'}
          </p>
        </div>
        {step === 'idle' && !enabled && (
          <button
            onClick={startSetup}
            disabled={setupBusy}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            {setupBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Activer'}
          </button>
        )}
        {step === 'idle' && enabled && !showDisableForm && (
          <button
            onClick={() => setShowDisableForm(true)}
            className="px-4 py-2.5 text-sm font-bold border rounded-xl border-red-500/20 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors whitespace-nowrap"
          >
            Désactiver
          </button>
        )}
      </div>

      {setupError && step === 'idle' && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
          {setupError}
        </div>
      )}

      {step === 'qr' && (
        <div className="space-y-4 pt-4 border-t border-line-subtle">
          {setupError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
              {setupError}
            </div>
          )}
          <p className="text-xs text-subtle">
            Scanne ce QR code avec Google Authenticator, Authy, ou toute app compatible TOTP — puis entre le code
            généré pour confirmer.
          </p>
          {qrDataUrl && (
            <div className="flex justify-center p-4 bg-white rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR code 2FA" width={220} height={220} />
            </div>
          )}
          {secret && (
            <p className="text-[11px] text-faint text-center">
              Impossible de scanner ? Entre cette clé manuellement : <code className="text-body-soft">{secret}</code>
            </p>
          )}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
              Code de confirmation
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              placeholder="123456"
              className="w-full sm:w-56 bg-page border border-line text-body rounded-lg p-3 text-center text-lg tracking-[0.3em] font-mono focus:border-purple-500 outline-none transition-colors"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={confirmSetup}
              disabled={setupBusy || confirmCode.length < 6}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
            >
              {setupBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirmer et activer
            </button>
            <button
              onClick={finishSetup}
              className="px-4 py-2.5 text-sm font-medium border rounded-xl border-line text-body-soft hover:bg-surface-alt transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {step === 'recovery-codes' && (
        <div className="space-y-4 pt-4 border-t border-line-subtle">
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">
              Sauvegarde ces codes de récupération dans un endroit sûr — ils ne seront plus jamais affichés. Chacun
              n&apos;est utilisable qu&apos;une seule fois, si tu perds l&apos;accès à ton app d&apos;authentification.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 p-4 rounded-xl bg-surface-alt/50 border border-line/50 font-mono text-sm text-body-soft">
            {recoveryCodes.map((c) => (
              <div key={c}>{c}</div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={copyRecoveryCodes}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold border rounded-xl border-line text-body-soft hover:bg-surface-alt transition-colors"
            >
              {codesCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {codesCopied ? 'Copié !' : 'Copier les codes'}
            </button>
            <button
              onClick={finishSetup}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
            >
              <Check className="w-4 h-4" />
              J&apos;ai sauvegardé mes codes
            </button>
          </div>
        </div>
      )}

      {showDisableForm && (
        <div className="space-y-3 pt-4 border-t border-line-subtle">
          {disableError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
              {disableError}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
              Mot de passe (confirmation requise)
            </label>
            <PasswordInput value={disablePassword} onChange={setDisablePassword} autoComplete="current-password" />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDisable}
              disabled={disableBusy}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
            >
              {disableBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmer la désactivation'}
            </button>
            <button
              onClick={() => {
                setShowDisableForm(false);
                setDisablePassword('');
                setDisableError(null);
              }}
              className="px-4 py-2.5 text-sm font-medium border rounded-xl border-line text-body-soft hover:bg-surface-alt transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
