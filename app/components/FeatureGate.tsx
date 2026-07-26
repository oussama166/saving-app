'use client';

import { useEffect, useState } from 'react';
import FeatureDisabledNotice from './FeatureDisabledNotice';

// Enrobe le contenu d'une page CLIENT (dashboard, coach, zakat, abonnements,
// dettes, profil — celles qui utilisent "use client" + fetch dans un
// useEffect, donc ne peuvent pas appeler isFeatureEnabledForUser()
// directement côté serveur comme les pages serveur). Interroge
// /api/features/check au montage ; tant que la réponse n'est pas arrivée on
// ne montre rien (évite un flash de contenu avant de savoir si l'accès est
// refusé) plutôt qu'un spinner dédié — la vérification est rapide (une seule
// requête légère) et les pages elles-mêmes affichent déjà leur propre état
// de chargement une fois montées.
export default function FeatureGate({
  featureKey,
  featureName,
  children,
}: {
  featureKey: string;
  featureName: string;
  children: React.ReactNode;
}) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/features/check?key=${encodeURIComponent(featureKey)}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((result) => {
        if (cancelled) return;
        // En cas d'échec de la vérification (réseau, session expirée...),
        // on laisse passer plutôt que de bloquer par erreur — la vraie
        // barrière de sécurité reste côté API (requireFeatureAccess), pas
        // cette vérification d'affichage.
        if (result.success) {
          setAllowed(Boolean(result.data?.allowed));
          setMessage(result.data?.message ?? null);
        } else {
          setAllowed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setAllowed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [featureKey]);

  if (allowed === null) return null;
  if (!allowed) return <FeatureDisabledNotice featureName={featureName} message={message} />;
  return <>{children}</>;
}
