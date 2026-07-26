import { Lock } from 'lucide-react';

// Variante "inline" de FeatureDisabledNotice : remplace un seul bloc/carte à
// l'intérieur d'une page qui reste par ailleurs accessible (ex: une des
// cartes de app/profil/page.tsx), plutôt que toute la page — utilisée pour
// les sous-fonctionnalités (Feature.parentKey non nul, voir lib/features.ts).
export default function FeatureDisabledInlineCard({ featureName, message }: { featureName: string; message?: string | null }) {
  return (
    <div className="p-6 border bg-surface rounded-2xl border-line flex items-start gap-4">
      <div className="p-3 border bg-surface-alt rounded-xl border-line shrink-0">
        <Lock className="w-5 h-5 text-muted" />
      </div>
      <div>
        <h2 className="text-sm font-black tracking-tight uppercase text-ink">{featureName}</h2>
        <p className="text-subtle text-xs mt-1 max-w-md">
          {message || 'Cette fonctionnalité est temporairement désactivée.'}
        </p>
      </div>
    </div>
  );
}
