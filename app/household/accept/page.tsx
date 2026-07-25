'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Users, Loader2, Check, AlertTriangle } from 'lucide-react';
import Logo from '../../components/Logo';

interface InviteInfo {
  valid: boolean;
  status: string;
  inviterName: string;
  email: string;
}

interface CurrentUser {
  id: string;
  email: string;
}

function AcceptForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) {
      // setState différé dans un microtask plutôt qu'appelé de façon
      // synchrone dans le corps de l'effect (règle react-hooks/set-state-in-effect).
      Promise.resolve().then(() => {
        setInviteError('Lien invalide — aucun jeton fourni.');
        setLoading(false);
      });
      return;
    }
    Promise.all([
      fetch(`/api/household/invite-info?token=${encodeURIComponent(token)}`).then((r) => r.json()),
      fetch('/api/auth/me')
        .then((r) => r.json())
        .catch(() => ({ success: false })),
    ])
      .then(([inviteResult, meResult]) => {
        if (!inviteResult.success) {
          setInviteError(inviteResult.error || 'Invitation introuvable');
        } else {
          setInvite(inviteResult.data);
        }
        if (meResult.success) {
          setCurrentUser({ id: meResult.user.id, email: meResult.user.email });
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    setAcceptError(null);
    setAccepting(true);
    try {
      const res = await fetch('/api/household/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const result = await res.json();
      if (!result.success) {
        setAcceptError(result.error || "Erreur lors de l'acceptation");
        return;
      }
      setAccepted(true);
      setTimeout(() => {
        router.push('/profil');
        router.refresh();
      }, 1500);
    } catch {
      setAcceptError('Erreur réseau');
    } finally {
      setAccepting(false);
    }
  };

  const nextParam = encodeURIComponent(`/household/accept?token=${token}`);
  const emailMismatch = currentUser && invite && currentUser.email.toLowerCase() !== invite.email.toLowerCase();

  return (
    <main className="min-h-screen bg-page flex items-center justify-center p-6 text-body font-sans">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3">
          <Logo size={56} className="shadow-lg shadow-blue-900/20 rounded-2xl" />
          <h1 className="text-2xl font-black tracking-tighter text-ink">Invitation à un foyer partagé</h1>
        </div>

        <div className="bg-surface border border-line rounded-2xl p-8 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-subtle text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Chargement...
            </div>
          ) : inviteError || !invite ? (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
              {inviteError || 'Invitation introuvable'}
            </div>
          ) : !invite.valid ? (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[13px] flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {invite.status === 'accepted'
                ? 'Cette invitation a déjà été acceptée.'
                : invite.status === 'expired'
                  ? 'Cette invitation a expiré.'
                  : 'Cette invitation n\'est plus valide.'}
            </div>
          ) : accepted ? (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[13px] flex items-center gap-2">
              <Check className="w-4 h-4" />
              Foyer rejoint ! Redirection...
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div className="p-3 border bg-blue-600/20 rounded-xl border-blue-500/20">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
                <p className="text-sm text-body-soft leading-relaxed">
                  <strong className="text-ink">{invite.inviterName}</strong> t&apos;invite à rejoindre son foyer sur
                  Wealth OS. Une fois accepté, vous partagez le même budget, comptes, transactions, objectifs et
                  abonnements.
                </p>
              </div>

              {acceptError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
                  {acceptError}
                </div>
              )}

              {!currentUser ? (
                <div className="space-y-3">
                  <p className="text-xs text-subtle">
                    Connecte-toi ou crée un compte avec l&apos;adresse <strong>{invite.email}</strong> pour accepter.
                  </p>
                  <div className="flex gap-3">
                    <Link
                      href={`/login?next=${nextParam}`}
                      className="flex-1 text-center bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg text-sm transition-colors"
                    >
                      Se connecter
                    </Link>
                    <Link
                      href={`/signup?next=${nextParam}&email=${encodeURIComponent(invite.email)}`}
                      className="flex-1 text-center border border-line text-body-soft hover:bg-surface-alt font-bold py-3 rounded-lg text-sm transition-colors"
                    >
                      Créer un compte
                    </Link>
                  </div>
                </div>
              ) : emailMismatch ? (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
                  Cette invitation est destinée à {invite.email}, mais tu es connecté avec {currentUser.email}.
                  Déconnecte-toi et reconnecte-toi avec le bon compte.
                </div>
              ) : (
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-sm"
                >
                  {accepting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Rejoindre le foyer
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function HouseholdAcceptPage() {
  return (
    <Suspense fallback={null}>
      <AcceptForm />
    </Suspense>
  );
}
