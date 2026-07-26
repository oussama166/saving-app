import { Lock } from 'lucide-react';

// Affiché à la place du contenu normal d'une page/section quand
// lib/features.ts::isFeatureEnabledForUser renvoie false pour l'utilisateur
// connecté — jamais une erreur brute, un message clair sur pourquoi il n'a
// pas accès. Utilisé à la fois par les pages serveur (saisie, portfolio,
// objectifs, analyse, santé) et par <FeatureGate> côté client (dashboard,
// coach, zakat, abonnements, dettes, profil).
export default function FeatureDisabledNotice({ featureName, message }: { featureName: string; message?: string | null }) {
  return (
    <main className="min-h-screen bg-page text-body flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="max-w-md w-full text-center p-8 border bg-surface rounded-2xl border-line space-y-4">
        <div className="w-12 h-12 mx-auto rounded-xl border bg-surface-alt border-line flex items-center justify-center">
          <Lock className="w-6 h-6 text-muted" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-lg font-black tracking-tight uppercase text-ink">{featureName}</h1>
          <p className="text-sm text-subtle">
            {message ||
              "Cette fonctionnalité est temporairement désactivée. Contacte l'administrateur si tu penses que c'est une erreur."}
          </p>
        </div>
      </div>
    </main>
  );
}
