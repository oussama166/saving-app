'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LogIn, ShieldCheck } from 'lucide-react';
import Logo from '../components/Logo';
import PasswordInput from '../components/PasswordInput';
import { useLanguage } from '../components/LanguageProvider';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Étape 2 (2FA) — affichée seulement si le compte a l'authentification à
  // deux facteurs activée (voir POST /api/auth/login qui renvoie
  // twoFactorRequired + un challengeToken temporaire au lieu du cookie de
  // session directement dans ce cas).
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  // Lu depuis un effet (jamais directement pendant le rendu) : useSearchParams()
  // peut renvoyer une valeur différente entre le rendu serveur (SSR, à partir
  // de l'URL de la requête initiale) et la première passe client (surtout
  // après une navigation interne avec un lien déjà préchargé) — utiliser
  // directement searchParams.get('next') dans le JSX provoque une erreur
  // d'hydratation (constaté sur le lien "Créer un compte" ci-dessous). null
  // au premier rendu des deux côtés = pas de désaccord possible.
  const [nextParam, setNextParam] = useState<string | null>(null);
  useEffect(() => {
    Promise.resolve().then(() => {
      setNextParam(searchParams.get('next'));
    });
  }, [searchParams]);

  const goToNext = () => {
    const next = searchParams.get('next') || '/';
    router.push(next);
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await res.json();
      if (!result.success) {
        setError(result.error || t('auth.errorLoginFailed'));
        return;
      }
      if (result.twoFactorRequired) {
        setChallengeToken(result.challengeToken);
        return;
      }
      goToNext();
    } catch {
      setError(t('auth.errorNetwork'));
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFactorError(null);
    setTwoFactorLoading(true);
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          useRecoveryCode
            ? { challengeToken, recoveryCode: twoFactorCode }
            : { challengeToken, code: twoFactorCode },
        ),
      });
      const result = await res.json();
      if (!result.success) {
        setTwoFactorError(result.error || 'Code incorrect');
        return;
      }
      goToNext();
    } catch {
      setTwoFactorError(t('auth.errorNetwork'));
    } finally {
      setTwoFactorLoading(false);
    }
  };

  if (challengeToken) {
    return (
      <main className="min-h-screen bg-page flex items-center justify-center p-6 text-body font-sans">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 border bg-blue-600/20 rounded-2xl border-blue-500/20">
              <ShieldCheck className="w-7 h-7 text-blue-400" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter text-ink">Vérification en 2 étapes</h1>
            <p className="text-subtle text-sm text-center">
              Entre le code à 6 chiffres de ton application d&apos;authentification.
            </p>
          </div>

          <form onSubmit={handleTwoFactorSubmit} className="bg-surface border border-line rounded-2xl p-8 space-y-5">
            {twoFactorError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
                {twoFactorError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                {useRecoveryCode ? 'Code de récupération' : 'Code à 6 chiffres'}
              </label>
              <input
                type="text"
                required
                autoFocus
                inputMode={useRecoveryCode ? 'text' : 'numeric'}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder={useRecoveryCode ? 'XXXX-XXXX' : '123456'}
                className="w-full bg-page border border-line text-body rounded-lg p-3 text-center text-lg tracking-[0.3em] font-mono focus:border-blue-500 outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={twoFactorLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50 text-sm"
            >
              {twoFactorLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Vérifier'
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setUseRecoveryCode((v) => !v);
                setTwoFactorCode('');
                setTwoFactorError(null);
              }}
              className="w-full text-center text-[13px] text-blue-400 font-semibold hover:text-blue-300"
            >
              {useRecoveryCode ? 'Utiliser le code à 6 chiffres' : 'Utiliser un code de récupération'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-page flex items-center justify-center p-6 text-body font-sans">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3">
          <Logo size={56} className="shadow-lg shadow-blue-900/20 rounded-2xl" />
          <h1 className="text-2xl font-black tracking-tighter text-ink">{t('auth.loginTitle')}</h1>
          <p className="text-subtle text-sm">{t('auth.loginSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-2xl p-8 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">{t('auth.email')}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="toi@example.com"
              className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                {t('auth.password')}
              </label>
              <Link href="/forgot-password" className="text-[11px] font-semibold text-blue-400 hover:text-blue-300">
                {t('auth.forgotPasswordLink')}
              </Link>
            </div>
            <PasswordInput
              required
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50 text-sm"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                {t('auth.loginButton')}
              </>
            )}
          </button>

          <p className="text-center text-[13px] text-subtle">
            {t('auth.noAccount')}{' '}
            <Link
              href={nextParam ? `/signup?next=${encodeURIComponent(nextParam)}` : '/signup'}
              className="text-blue-400 font-semibold hover:text-blue-300"
            >
              {t('auth.createAccount')}
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
