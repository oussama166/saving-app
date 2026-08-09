'use client';

import { useEffect, useState } from 'react';
import { Smartphone, Loader2, LogOut, ShieldCheck } from 'lucide-react';

interface SessionItem {
  id: string;
  userAgent: string | null;
  createdAt: string;
  isCurrent: boolean;
}

// Liste des appareils connectés + révocation à distance (voir
// lib/sessionTracking.ts, app/api/sessions). Révoquer un appareil n'est PAS
// instantané : ça prend effet au prochain chargement de page sur cet
// appareil (check dans app/layout.tsx), pas en plein milieu d'une action en
// cours — compromis assumé pour éviter un aller-retour base de données sur
// absolument chaque requête.
export default function SessionsCard() {
  const [sessions, setSessions] = useState<SessionItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = () => {
    fetch('/api/sessions')
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setSessions(result.data);
        else setError(result.error || 'Erreur lors du chargement');
      })
      .catch((err) => {
        console.error('Sessions fetch error:', err);
        setError('Erreur réseau');
      });
  };

  useEffect(load, []);

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        setSessions((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
      } else {
        setError(result.error || 'Erreur lors de la révocation');
      }
    } catch (err) {
      console.error('Session revoke error:', err);
      setError('Erreur réseau');
    } finally {
      setRevokingId(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="p-6 border bg-surface rounded-2xl border-line space-y-4">
      <div className="flex items-center gap-4">
        <div className="p-3 border bg-cyan-600/20 rounded-xl border-cyan-500/20">
          <Smartphone className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-sm font-black tracking-tight uppercase text-ink">
            Appareils connectés
          </h2>
          <p className="text-subtle text-xs mt-0.5 max-w-md">
            Les appareils où tu es actuellement connecté. Déconnecte un appareil que tu ne
            reconnais pas ou que tu as perdu — effectif au prochain chargement de page sur cet
            appareil (pas instantané).
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
          {error}
        </div>
      )}

      {sessions === null ? (
        <div className="flex items-center gap-2 text-xs text-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement...
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-xs text-subtle">Aucun appareil connecté trouvé.</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 p-3 bg-surface-alt border border-line rounded-xl"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 p-2 border bg-page rounded-lg border-line">
                  <Smartphone className="w-4 h-4 text-body-soft" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-body truncate">
                      {s.userAgent ?? 'Appareil inconnu'}
                    </span>
                    {s.isCurrent && (
                      <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full whitespace-nowrap">
                        <ShieldCheck className="w-3 h-3" />
                        Cet appareil
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-faint">Connecté le {formatDate(s.createdAt)}</p>
                </div>
              </div>
              {!s.isCurrent && (
                <button
                  onClick={() => handleRevoke(s.id)}
                  disabled={revokingId === s.id}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-400 border rounded-xl border-red-500/20 bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {revokingId === s.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <LogOut className="w-3.5 h-3.5" />
                  )}
                  Déconnecter
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
