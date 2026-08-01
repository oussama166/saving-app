'use client';

import { RefreshCw } from 'lucide-react';
import { useLanguage } from './LanguageProvider';

// Bouton "Régénérer" partagé par les 5 sections Coach IA — ignore le cache
// hebdomadaire (voir lib/coachHandler.ts, flag `force`) pour forcer un
// nouvel appel LLM immédiat, utile après une grosse transaction ou un
// changement de méthode budgétaire que l'invalidation automatique par hash
// n'aurait pas encore capté.
export default function CoachRegenerateButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 text-[10px] text-subtle hover:text-body font-bold uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
      {loading ? t('coach.regenerating') : t('coach.regenerate')}
    </button>
  );
}
