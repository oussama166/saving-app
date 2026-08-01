'use client';

import { useState, useEffect } from 'react';
import { TerminalSquare, Database, RefreshCw, X } from 'lucide-react';

interface DevInfo {
  nodeEnv: string;
  database: { label: string; kind: 'local' | 'preprod' | 'prod' | 'other'; host: string | null };
  siteUrl: string | null;
}

const KIND_STYLES: Record<DevInfo['database']['kind'], { dot: string; text: string; ring: string }> = {
  local: { dot: 'bg-blue-500', text: 'text-blue-400', ring: 'border-blue-500/30' },
  preprod: { dot: 'bg-emerald-500', text: 'text-emerald-400', ring: 'border-emerald-500/30' },
  prod: { dot: 'bg-red-500', text: 'text-red-400', ring: 'border-red-500/50' },
  other: { dot: 'bg-amber-500', text: 'text-amber-400', ring: 'border-amber-500/30' },
};

// Badge visible UNIQUEMENT en développement local (process.env.NODE_ENV, une
// des rares variables que Next.js remplace statiquement même côté client,
// pas besoin de préfixe NEXT_PUBLIC_) — au clic, ouvre un petit panneau avec
// l'environnement/la base réellement utilisés par le serveur. Objectif :
// ne plus jamais confondre wealthos-prod et wealthos-preprod en local (voir
// l'incident de session qui a précédé ce composant). /api/dev-info renvoie
// aussi 404 hors développement, en filet de sécurité supplémentaire — ce
// composant ne s'affiche donc jamais en prod même si le check ci-dessous
// était contourné.
export default function DevEnvBadge() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<DevInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    fetch('/api/dev-info')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setInfo(data))
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Différé en microtask (voir react-hooks/set-state-in-effect, même motif
    // qu'ailleurs dans l'app, ex: app/page.tsx) — load() appelle setLoading
    // de façon synchrone sinon.
    Promise.resolve().then(() => {
      load();
    });
  }, []);

  if (process.env.NODE_ENV !== 'development') return null;

  const kind = info?.database.kind ?? 'other';
  const style = KIND_STYLES[kind];

  return (
    // top-20 (sous la barre de nav, h-16 + marge) et z-[70] (au-dessus du
    // z-[60] de TopNav, voir app/components/TopNav.tsx) — sinon le badge se
    // retrouvait rendu sous la nav, invisible malgré `fixed`.
    <div className="fixed top-20 right-4 z-[70] flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border bg-surface shadow-sm text-[10px] font-bold uppercase tracking-widest transition-colors ${style.ring} ${style.text}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
        <TerminalSquare className="w-3 h-3" />
        Dev
      </button>

      {open && (
        <div className="w-72 bg-surface border border-line rounded-xl shadow-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-subtle">Environnement dev</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="p-1 text-subtle hover:text-body rounded transition-colors"
                title="Rafraîchir"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 text-subtle hover:text-body rounded transition-colors"
                title="Fermer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!info ? (
            <p className="text-xs text-subtle">Chargement...</p>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-start gap-2">
                <Database className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${style.text}`} />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-bold text-subtle tracking-widest">Base de données</p>
                  <p className={`text-xs font-bold truncate ${style.text}`}>{info.database.label}</p>
                  {info.database.host && (
                    <p className="text-[10px] text-faint truncate">{info.database.host}</p>
                  )}
                </div>
              </div>

              {kind === 'prod' && (
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-400 font-medium leading-relaxed">
                  Attention — ce dev local tape sur la base de PRODUCTION.
                </div>
              )}

              <div className="pt-2 border-t border-line-subtle space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-subtle">NODE_ENV</span>
                  <span className="text-body-soft font-mono">{info.nodeEnv}</span>
                </div>
                {info.siteUrl && (
                  <div className="flex justify-between gap-2 text-[11px]">
                    <span className="text-subtle shrink-0">Site URL</span>
                    <span className="text-body-soft font-mono truncate">{info.siteUrl}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
