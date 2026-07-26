import { prisma } from '@/lib/prisma';

// Devises proposées à la création d'un compte, en plus de MAD (défaut) —
// liste volontairement restreinte aux devises les plus pertinentes pour un
// compte détenu par un utilisateur marocain (revenu freelance en
// USD/EUR/GBP via Wise/Payoneer, proches en zone Golfe, etc.) plutôt que les
// ~170 devises de l'API. Toujours étendable si besoin.
export const SUPPORTED_CURRENCIES = ['MAD', 'EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AED'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h — les taux de change n'ont pas besoin d'être temps réel ici

/**
 * Taux de conversion vers MAD (devise de référence de l'app) pour une devise
 * donnée : 1 unité de `currency` = N MAD. Toujours 1 pour "MAD" (raccourci
 * sans appel réseau ni lecture DB — le cas de l'immense majorité des
 * comptes). Pour une devise étrangère, sert le cache DB (ExchangeRateCache)
 * s'il a moins de 24h, sinon rafraîchit depuis open.er-api.com (API
 * gratuite, sans clé, taux basés sur les banques centrales, MAJ quotidienne)
 * — voir prisma/schema.prisma pour le modèle de cache.
 *
 * Ne lève jamais : en cas d'échec réseau, retombe sur le dernier taux connu
 * en cache (même périmé) plutôt que de faire planter tout un calcul de
 * patrimoine pour un souci temporaire côté API externe. Si aucun taux n'a
 * jamais été mis en cache ET que l'API échoue, retombe sur 1 (pas de
 * conversion) — pire cas très rare (1er compte en devise étrangère + API
 * indisponible pile ce jour-là).
 */
export async function getRateToMad(currency: string): Promise<number> {
  if (currency === 'MAD') return 1;

  const cached = await prisma.exchangeRateCache.findUnique({ where: { currency } });
  const isFresh = cached && Date.now() - cached.fetchedAt.getTime() < CACHE_MAX_AGE_MS;
  if (isFresh) return cached.rateToMad;

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(currency)}`, {
      // Next.js fetch cache : pas pertinent ici (on gère notre propre cache
      // 24h en DB), on désactive pour éviter une couche de cache en plus.
      cache: 'no-store',
    });
    const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
    const madRate = data?.rates?.MAD;
    if (data?.result !== 'success' || typeof madRate !== 'number' || !Number.isFinite(madRate)) {
      throw new Error(`Réponse taux de change invalide pour ${currency}`);
    }

    await prisma.exchangeRateCache.upsert({
      where: { currency },
      update: { rateToMad: madRate, fetchedAt: new Date() },
      create: { currency, rateToMad: madRate, fetchedAt: new Date() },
    });

    return madRate;
  } catch (error) {
    console.error(`getRateToMad(${currency}) — échec du rafraîchissement:`, error);
    return cached?.rateToMad ?? 1;
  }
}

/**
 * Convertit un montant depuis `currency` vers son équivalent MAD. Raccourci
 * pratique pour tous les points d'agrégation (dashboard, bilan, zakat...).
 */
export async function convertToMad(amount: number, currency: string): Promise<number> {
  if (currency === 'MAD') return amount;
  const rate = await getRateToMad(currency);
  return amount * rate;
}

/**
 * Résout les taux de TOUTES les devises distinctes fournies en un seul
 * batch (une requête réseau par devise étrangère distincte, en parallèle) —
 * utilisé quand on doit convertir beaucoup de comptes/transactions d'un
 * coup plutôt que d'appeler getRateToMad() en boucle séquentielle.
 */
export async function getRatesToMad(currencies: string[]): Promise<Record<string, number>> {
  const distinct = Array.from(new Set(currencies.filter((c) => c !== 'MAD')));
  const entries = await Promise.all(distinct.map(async (c) => [c, await getRateToMad(c)] as const));
  const rates: Record<string, number> = { MAD: 1 };
  for (const [c, r] of entries) rates[c] = r;
  return rates;
}
