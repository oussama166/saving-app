'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import Logo from '../components/Logo';
import PasswordInput from '../components/PasswordInput';
import { useLanguage } from '../components/LanguageProvider';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [name, setName] = useState('');
  // Préremplie depuis ?email= (ex: lien "Créer un compte" depuis
  // /household/accept — l'invitation cible une adresse précise).
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t('auth.errorPasswordMismatch'));
      return;
    }
    if (password.length < 8) {
      setError(t('auth.errorPasswordTooShort'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const result = await res.json();
      if (!result.success) {
        setError(result.error || t('auth.errorSignupFailed'));
        return;
      }
      const next = searchParams.get('next') || '/';
      router.push(next);
      router.refresh();
    } catch {
      setError(t('auth.errorNetwork'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-page flex items-center justify-center p-6 text-body font-sans">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3">
          <Logo size={56} className="shadow-lg shadow-blue-900/20 rounded-2xl" />
          <h1 className="text-2xl font-black tracking-tighter text-ink">{t('auth.loginTitle')}</h1>
          <p className="text-subtle text-sm text-center">{t('auth.signupSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-2xl p-8 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
              {t('auth.nameOptional')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Oussama"
              className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
            />
          </div>

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
            <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
              {t('auth.password')}
            </label>
            <PasswordInput
              required
              value={password}
              onChange={setPassword}
              placeholder={t('auth.passwordMinChars')}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
              {t('auth.confirmPassword')}
            </label>
            <PasswordInput
              required
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="••••••••"
              autoComplete="new-password"
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
                <UserPlus className="w-4 h-4" />
                {t('auth.signupButton')}
              </>
            )}
          </button>

          <p className="text-center text-[13px] text-subtle">
            {t('auth.hasAccount')}{' '}
            <Link
              href={searchParams.get('next') ? `/login?next=${encodeURIComponent(searchParams.get('next')!)}` : '/login'}
              className="text-blue-400 font-semibold hover:text-blue-300"
            >
              {t('auth.loginLink')}
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
