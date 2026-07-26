'use client';

import { useEffect, useState } from 'react';
import { Users, Loader2, Mail, X, LogOut, Crown, Send } from 'lucide-react';

interface HouseholdMemberInfo {
  userId: string;
  email: string;
  name: string | null;
  isBudgetOwner: boolean;
  isSelf: boolean;
}

interface PendingInvite {
  id: string;
  email: string;
  expiresAt: string;
}

interface HouseholdDetails {
  householdId: string;
  isFull: boolean;
  members: HouseholdMemberInfo[];
  pendingInvites: PendingInvite[];
}

export default function HouseholdCard() {
  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState<HouseholdDetails | null>(null);
  const [email, setEmail] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  // Rafraîchissement après une action (inviter/annuler/quitter) — appelé
  // depuis des handlers d'événements, jamais directement dans un effect (voir
  // ci-dessous : appeler setState de façon synchrone dans le corps d'un
  // effect déclenche des rendus en cascade, règle react-hooks/set-state-in-effect).
  const loadHousehold = () => {
    setLoading(true);
    fetch('/api/household')
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setHousehold(result.data);
      })
      .catch((err) => console.error('Household fetch error:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch('/api/household')
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setHousehold(result.data);
      })
      .catch((err) => console.error('Household fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleInvite = async () => {
    setInviteError(null);
    setInviteSent(false);
    if (!email.trim()) {
      setInviteError('Adresse email requise');
      return;
    }
    setInviteBusy(true);
    try {
      const res = await fetch('/api/household/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const result = await res.json();
      if (!result.success) {
        setInviteError(result.error || "Erreur lors de l'envoi de l'invitation");
        return;
      }
      setEmail('');
      setInviteSent(true);
      setTimeout(() => setInviteSent(false), 3000);
      loadHousehold();
    } catch (err) {
      console.error('Household invite error:', err);
      setInviteError('Erreur réseau');
    } finally {
      setInviteBusy(false);
    }
  };

  const handleCancelInvite = async (id: string) => {
    setCancellingId(id);
    try {
      const res = await fetch(`/api/household/invite/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) loadHousehold();
    } catch (err) {
      console.error('Household cancel invite error:', err);
    } finally {
      setCancellingId(null);
    }
  };

  const handleLeave = async () => {
    setLeaveError(null);
    setLeaveBusy(true);
    try {
      const res = await fetch('/api/household/leave', { method: 'POST' });
      const result = await res.json();
      if (!result.success) {
        setLeaveError(result.error || 'Erreur lors du départ du foyer');
        return;
      }
      setShowLeaveConfirm(false);
      loadHousehold();
    } catch (err) {
      console.error('Household leave error:', err);
      setLeaveError('Erreur réseau');
    } finally {
      setLeaveBusy(false);
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

  const inHousehold = Boolean(household);

  return (
    <div className="p-6 border bg-surface rounded-2xl border-line space-y-4">
      <div className="flex items-center gap-4">
        <div
          className={`p-3 border rounded-xl ${inHousehold ? 'bg-blue-600/20 border-blue-500/20' : 'bg-surface-alt border-line'}`}
        >
          <Users className={`w-6 h-6 ${inHousehold ? 'text-blue-400' : 'text-subtle'}`} />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-black tracking-tight uppercase text-ink">Foyer partagé</h2>
          <p className="text-subtle text-xs mt-0.5">
            {inHousehold
              ? 'Budget, comptes, transactions, objectifs et abonnements partagés avec ton foyer.'
              : "Invite ton/ta partenaire à partager le même budget — comptes, transactions, objectifs et abonnements en commun."}
          </p>
        </div>
      </div>

      {inHousehold && household && (
        <div className="space-y-2 pt-4 border-t border-line-subtle">
          {household.members.map((m) => (
            <div
              key={m.userId}
              className="flex items-center justify-between p-3 rounded-xl bg-surface-alt/50 border border-line/50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-semibold text-body-soft truncate">
                  {m.isSelf ? 'Toi' : m.name || m.email}
                </span>
                {m.isBudgetOwner && (
                  <span title="Propriétaire du budget (compte historique)">
                    <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  </span>
                )}
              </div>
              <span className="text-[11px] text-faint truncate ml-2">{m.email}</span>
            </div>
          ))}

          {household.pendingInvites.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/20"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-sm text-body-soft truncate">{inv.email}</span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0">
                  En attente
                </span>
              </div>
              <button
                onClick={() => handleCancelInvite(inv.id)}
                disabled={cancellingId === inv.id}
                className="p-1.5 text-subtle hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                title="Annuler l'invitation"
              >
                {cancellingId === inv.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <X className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {inHousehold && household && !household.isFull && (
        <div className="space-y-2 pt-4 border-t border-line-subtle">
          {inviteError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
              {inviteError}
            </div>
          )}
          {inviteSent && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[13px]">
              Invitation envoyée !
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="partenaire@example.com"
              className="flex-1 bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
            />
            <button
              onClick={handleInvite}
              disabled={inviteBusy}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
            >
              {inviteBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Inviter
            </button>
          </div>
        </div>
      )}

      {!inHousehold && (
        <div className="space-y-2 pt-4 border-t border-line-subtle">
          {inviteError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
              {inviteError}
            </div>
          )}
          {inviteSent && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[13px]">
              Invitation envoyée !
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="partenaire@example.com"
              className="flex-1 bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
            />
            <button
              onClick={handleInvite}
              disabled={inviteBusy}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
            >
              {inviteBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Inviter
            </button>
          </div>
        </div>
      )}

      {inHousehold && (
        <div className="pt-4 border-t border-line-subtle">
          {leaveError && (
            <div className="p-3 mb-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
              {leaveError}
            </div>
          )}
          {!showLeaveConfirm ? (
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold border rounded-xl border-red-500/20 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Quitter le foyer
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                Quitter dissout le foyer entier : chacun récupère automatiquement son propre budget (les
                transactions, comptes et objectifs déjà enregistrés restent inchangés, seul le partage s&apos;arrête).
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleLeave}
                  disabled={leaveBusy}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
                >
                  {leaveBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmer le départ'}
                </button>
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="px-4 py-2.5 text-sm font-medium border rounded-xl border-line text-body-soft hover:bg-surface-alt transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
