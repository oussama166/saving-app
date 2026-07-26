import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { getFeatureStatusesForUser, isKnownFeatureKey } from '@/lib/features';

// force-dynamic + Cache-Control explicite sur chaque réponse : cette route
// doit TOUJOURS refléter l'état actuel de la Feature (un admin peut la
// réactiver à tout moment) — sans ça, un simple cache navigateur/proxy sur ce
// GET peut servir indéfiniment un "désactivé" périmé après réactivation côté
// admin (symptôme observé : on réactive une section dans /admin/features,
// mais elle reste bloquée côté utilisateur tant qu'il ne vide pas son cache).
export const dynamic = 'force-dynamic';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

// Endpoint utilisé côté client par <FeatureGate> (une seule clé, via `key`)
// et par des pages avec plusieurs sous-fonctionnalités comme
// app/profil/page.tsx (plusieurs clés en une requête, via `keys`, séparées
// par des virgules) pour savoir si chacune est activée pour l'utilisateur
// connecté, avec le message custom éventuel à afficher si désactivée. Les
// pages rendues côté serveur (saisie, portfolio, objectifs, analyse, santé)
// n'ont pas besoin de cet endpoint : elles appellent directement
// getFeatureStatusForUser()/isFeatureEnabledForUser() pendant le rendu
// serveur.
export async function GET(req: Request) {
  try {
    const { userId } = await requireSession();
    const { searchParams } = new URL(req.url);
    const singleKey = searchParams.get('key');
    const keysParam = searchParams.get('keys');

    const keys = keysParam
      ? keysParam.split(',').map((k) => k.trim()).filter(Boolean)
      : singleKey
        ? [singleKey]
        : [];

    if (keys.length === 0 || keys.some((k) => !isKnownFeatureKey(k))) {
      return NextResponse.json({ success: false, error: 'Clé(s) de fonctionnalité invalide(s)' }, { status: 400, ...NO_STORE });
    }

    const statuses = await getFeatureStatusesForUser(keys, userId);

    // Mode single-key (compat <FeatureGate>) : renvoie directement { allowed }.
    if (singleKey && !keysParam) {
      return NextResponse.json({ success: true, data: statuses[singleKey] }, NO_STORE);
    }

    return NextResponse.json({ success: true, data: statuses }, NO_STORE);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401, ...NO_STORE });
    }
    console.error('Feature Check Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500, ...NO_STORE });
  }
}
