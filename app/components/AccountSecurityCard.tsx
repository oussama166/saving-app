'use client';

import { useEffect, useState } from 'react';
import {
  UserCog,
  KeyRound,
  ShieldAlert,
  Loader2,
  Check,
  Trash2,
} from 'lucide-react';
import PasswordInput from './PasswordInput';

export default function AccountSecurityCard() {
  const [loading, setLoading] = useState(true);

  // Profile fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Change password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Delete account
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setName(result.user.name || '');
          setEmail(result.user.email);
          setOriginalEmail(result.user.email);
        }
      })
      .catch((err) => console.error('Profile fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  const emailChanged = email.trim().toLowerCase() !== originalEmail.trim().toLowerCase();

  const handleProfileSave = async () => {
    setProfileError(null);
    setProfileSaved(false);
    if (emailChanged && !profilePassword) {
      setProfileError('Mot de passe actuel requis pour changer d’email');
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          ...(emailChanged ? { currentPassword: profilePassword } : {}),
        }),
      });
      const result = await res.json();
      if (!result.success) {
        setProfileError(result.error || 'Erreur lors de la mise à jour');
        return;
      }
      setOriginalEmail(result.user.email);
      setProfilePassword('');
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      console.error('Profile save error:', err);
      setProfileError('Erreur réseau');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordError(null);
    setPasswordSaved(false);
    if (newPassword.length < 8) {
      setPasswordError('Le nouveau mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas');
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await res.json();
      if (!result.success) {
        setPasswordError(result.error || 'Erreur lors du changement de mot de passe');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch (err) {
      console.error('Password change error:', err);
      setPasswordError('Erreur réseau');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError(null);
    if (!deletePassword) {
      setDeleteError('Mot de passe requis');
      return;
    }
    if (deleteConfirmText !== 'SUPPRIMER') {
      setDeleteError('Tape SUPPRIMER pour confirmer');
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      });
      const result = await res.json();
      if (!result.success) {
        setDeleteError(result.error || 'Erreur lors de la suppression');
        setDeleting(false);
        return;
      }
      window.location.href = '/login';
    } catch (err) {
      console.error('Account delete error:', err);
      setDeleteError('Erreur réseau');
      setDeleting(false);
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
    <div className="space-y-6">
      {/* Profile update */}
      <div className="p-6 border bg-surface rounded-2xl border-line space-y-4">
        <div className="flex items-center gap-4">
          <div className="p-3 border bg-blue-600/20 rounded-xl border-blue-500/20">
            <UserCog className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight uppercase text-ink">
              Profil
            </h2>
            <p className="text-subtle text-xs mt-0.5">Nom et adresse email du compte.</p>
          </div>
        </div>

        {profileError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
            {profileError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Nom</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setProfileSaved(false);
              }}
              placeholder="Ton nom"
              className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setProfileSaved(false);
              }}
              className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
            />
          </div>
        </div>

        {emailChanged && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
              Mot de passe actuel (requis pour changer d&apos;email)
            </label>
            <PasswordInput
              value={profilePassword}
              onChange={setProfilePassword}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleProfileSave}
            disabled={profileSaving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
          >
            {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Enregistrer
          </button>
          {profileSaved && <span className="text-xs font-medium text-emerald-400">Profil mis à jour</span>}
        </div>
      </div>

      {/* Change password */}
      <div className="p-6 border bg-surface rounded-2xl border-line space-y-4">
        <div className="flex items-center gap-4">
          <div className="p-3 border bg-amber-600/20 rounded-xl border-amber-500/20">
            <KeyRound className="w-6 h-6 text-amber-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-black tracking-tight uppercase text-ink">
              Mot de passe
            </h2>
            <p className="text-subtle text-xs mt-0.5">Change ton mot de passe de connexion.</p>
          </div>
          <button
            onClick={() => setShowPasswordFields((v) => !v)}
            className="px-3 py-2 text-xs font-medium border rounded-xl border-line text-body-soft hover:bg-surface-alt transition-colors whitespace-nowrap"
          >
            {showPasswordFields ? 'Annuler' : 'Modifier'}
          </button>
        </div>

        {showPasswordFields && (
          <div className="space-y-4">
            {passwordError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
                {passwordError}
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                Mot de passe actuel
              </label>
              <PasswordInput value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                  Nouveau mot de passe
                </label>
                <PasswordInput value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Confirmer</label>
                <PasswordInput value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePasswordChange}
                disabled={passwordSaving}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
              >
                {passwordSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Changer le mot de passe
              </button>
              {passwordSaved && <span className="text-xs font-medium text-emerald-400">Mot de passe changé</span>}
            </div>
          </div>
        )}
      </div>

      {/* Delete account */}
      <div className="p-6 border bg-red-500/5 rounded-2xl border-red-500/20 space-y-4">
        <div className="flex items-center gap-4">
          <div className="p-3 border bg-red-600/20 rounded-xl border-red-500/20">
            <ShieldAlert className="w-6 h-6 text-red-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-black tracking-tight uppercase text-red-400">
              Zone dangereuse
            </h2>
            <p className="text-subtle text-xs mt-0.5">
              Supprime définitivement ton compte et toutes tes données (transactions, comptes,
              objectifs, patrimoine). Action irréversible.
            </p>
          </div>
          {!deleteOpen && (
            <button
              onClick={() => setDeleteOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-400 border rounded-xl border-red-500/20 bg-red-500/10 hover:bg-red-500/20 transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Supprimer mon compte
            </button>
          )}
        </div>

        {deleteOpen && (
          <div className="space-y-4 border-t border-red-500/20 pt-4">
            {deleteError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
                {deleteError}
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">Mot de passe</label>
              <PasswordInput value={deletePassword} onChange={setDeletePassword} autoComplete="current-password" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                Tape <span className="text-red-400">SUPPRIMER</span> pour confirmer
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="SUPPRIMER"
                className="w-full bg-page border border-red-500/30 text-body rounded-lg p-3 focus:border-red-500 outline-none transition-colors text-sm"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Supprimer définitivement
              </button>
              <button
                onClick={() => {
                  setDeleteOpen(false);
                  setDeletePassword('');
                  setDeleteConfirmText('');
                  setDeleteError(null);
                }}
                disabled={deleting}
                className="px-4 py-2.5 text-sm font-medium border rounded-xl border-line text-body-soft hover:bg-surface-alt transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
