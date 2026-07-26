// Devine la catégorie d'une dépense à partir de la position GPS envoyée par
// le Shortcut iOS Apple Pay, via l'API Places de Geoapify. Best-effort : en
// cas d'échec/timeout/pas de correspondance/clé manquante, on retourne null
// et l'appelant retombe sur "Uncategorized" comme avant.
//
// Remplace une première implémentation basée sur l'API Overpass
// (OpenStreetMap) : les instances publiques Overpass se sont révélées trop
// peu fiables pour un usage temps réel (timeouts/504 fréquents, confirmé par
// la doc officielle qui déconseille Overpass en production — voir
// https://wiki.openstreetmap.org/wiki/Overpass_API). Geoapify est un vrai
// service commercial avec SLA, gratuit jusqu'à 3000 requêtes/jour, sans
// carte bancaire requise. Nécessite une clé API : GEOAPIFY_API_KEY dans .env
// (inscription gratuite sur https://www.geoapify.com/).

interface GeoapifyFeature {
  properties?: {
    name?: string;
    categories?: string[];
    distance?: number;
  };
}

interface GeoapifyResponse {
  features: GeoapifyFeature[];
}

export interface PlaceCategoryGuess {
  categoryName: string;
  subCategoryName?: string;
  matchedPlaceName: string;
}

// Mappe les catégories Geoapify (voir https://apidocs.geoapify.com/docs/places/#categories)
// vers les catégories WealthOS définies dans lib/seedDefaults.ts
// (DEFAULT_CATEGORIES). Les clés utilisent le niveau de hiérarchie le plus
// général suffisant : Geoapify renvoie tous les niveaux de la hiérarchie
// dans `properties.categories` (ex: une crêperie renvoie à la fois
// "catering.cafe" et "catering.cafe.crepe"), donc matcher sur le niveau
// général suffit à couvrir toutes les sous-catégories.
const GEOAPIFY_CATEGORY_TO_WEALTHOS: Record<string, { categoryName: string; subCategoryName?: string }> = {
  'catering.restaurant': { categoryName: 'Alimentation & Restauration', subCategoryName: 'Restaurant' },
  'catering.fast_food': { categoryName: 'Alimentation & Restauration', subCategoryName: 'Café / Fast-food' },
  'catering.cafe': { categoryName: 'Alimentation & Restauration', subCategoryName: 'Café / Fast-food' },
  'catering.bar': { categoryName: 'Alimentation & Restauration', subCategoryName: 'Restaurant' },
  'catering.pub': { categoryName: 'Alimentation & Restauration', subCategoryName: 'Restaurant' },
  'catering.biergarten': { categoryName: 'Alimentation & Restauration', subCategoryName: 'Restaurant' },
  'catering.food_court': { categoryName: 'Alimentation & Restauration', subCategoryName: 'Restaurant' },
  'catering.ice_cream': { categoryName: 'Alimentation & Restauration', subCategoryName: 'Café / Fast-food' },
  'commercial.supermarket': { categoryName: 'Alimentation & Restauration', subCategoryName: 'Épicerie/Courses' },
  'commercial.convenience': { categoryName: 'Alimentation & Restauration', subCategoryName: 'Épicerie/Courses' },
  'commercial.food_and_drink': { categoryName: 'Alimentation & Restauration', subCategoryName: 'Épicerie/Courses' },
  'healthcare.pharmacy': { categoryName: 'Santé & Médical', subCategoryName: 'Pharmacie/Médicaments' },
  'healthcare.clinic_or_praxis': { categoryName: 'Santé & Médical', subCategoryName: 'Médecin Généraliste' },
  'healthcare.dentist': { categoryName: 'Santé & Médical', subCategoryName: 'Dentiste' },
  'healthcare.hospital': { categoryName: 'Santé & Médical' },
  'commercial.gas': { categoryName: 'Transport & Mobilité', subCategoryName: 'Carburant' },
  'public_transport': { categoryName: 'Transport & Mobilité', subCategoryName: 'Transport en commun' },
  'entertainment.cinema': { categoryName: 'Loisirs & Divertissement', subCategoryName: 'Cinéma/Sorties' },
  'sport.fitness': { categoryName: 'Loisirs & Divertissement', subCategoryName: 'Sport & Fitness' },
  'sport.sports_centre': { categoryName: 'Loisirs & Divertissement', subCategoryName: 'Sport & Fitness' },
  'commercial.clothing': { categoryName: 'Shopping & Vêtements', subCategoryName: 'Vêtements & Chaussures' },
  'commercial.department_store': { categoryName: 'Shopping & Vêtements' },
  'commercial.discount_store': { categoryName: 'Shopping & Vêtements' },
  'commercial.elektronics': { categoryName: 'Tech & Abonnements', subCategoryName: 'Matériel Informatique' }, // orthographe exacte utilisée par l'API Geoapify
};

// Catégories demandées à l'API (niveau général — Geoapify inclut
// automatiquement toutes les sous-catégories correspondantes). Ne doit
// contenir QUE des clés valides côté Geoapify (voir GEOAPIFY_CATEGORY_TO_WEALTHOS
// ci-dessus) — les clés purement locales (LOCAL_ONLY_CATEGORY_HINTS
// ci-dessous) ne doivent jamais y apparaître, sous peine de faire échouer
// l'appel réseau réel avec une catégorie inconnue.
const REQUESTED_CATEGORIES = Object.keys(GEOAPIFY_CATEGORY_TO_WEALTHOS).join(',');

// Catégories devinées uniquement à partir de mots-clés locaux (jamais
// envoyées à l'API Geoapify) — pour des cas où le mot-clé du nom est un
// signal plus fiable que ce que renverrait une recherche géographique. Ex :
// "Glovo" est classé MCC 4789 ("transport") par les banques, mais désigne en
// pratique presque toujours une livraison de repas au Maroc.
const LOCAL_ONLY_CATEGORY_HINTS: Record<string, { categoryName: string; subCategoryName?: string }> = {
  'local.food_delivery': { categoryName: 'Alimentation & Restauration', subCategoryName: 'Livraison à domicile' },
};

// Mots-clés (FR/EN/darija translittéré, déjà normalisés — minuscules, sans
// accents) trouvés dans le nom du marchand envoyé par Apple Pay. Utilisés
// pour deux choses :
//  1. Deviner la catégorie directement à partir du nom, SANS appeler
//     Geoapify (voir guessCategoryFromMerchantName ci-dessous) — évite un
//     appel réseau quand le nom seul suffit ("KFC", "Marjane Massira"...).
//  2. Départager des candidats ambigus quand on doit quand même appeler
//     Geoapify (plusieurs commerces proches, aucun ne correspond par nom).
// La liste "mangeable" pour les snacks/fast-food est volontairement large :
// un nom de plat/produit dans le nom du commerce est un signal fort qu'il
// s'agit d'un point de restauration, même si le nom exact n'est pas dans
// notre base.
const MERCHANT_KEYWORD_HINTS: { keywords: string[]; categories: string[] }[] = [
  { keywords: ['cafe', 'coffee'], categories: ['catering.cafe'] },
  { keywords: ['resto', 'restaurant', 'brasserie', 'gastro'], categories: ['catering.restaurant'] },
  {
    // "Choses mangeables" — plats, produits ou types de restauration rapide.
    // Un merchant nommé d'après un plat est presque toujours un snack/resto.
    keywords: [
      'snack', 'fastfood', 'fast food',
      'tacos', 'burger', 'hamburger', 'cheeseburger', 'sandwich', 'sandwicherie',
      'kebab', 'chawarma', 'shawarma', 'grillade', 'grillades', 'brochette', 'brochettes',
      'rotisserie', 'poulet', 'chicken', 'frites', 'pizza', 'pizzeria',
      'panini', 'hotdog', 'hot dog', 'churros', 'crepe', 'creperie', 'gaufre', 'waffle',
      'donut', 'sushi', 'ramen', 'noodle', 'pasta', 'pates', 'msemen', 'rghaif',
      'tajine', 'couscous', 'harira', 'glace', 'glacier', 'icecream', 'ice cream',
      'patisserie', 'boulangerie', 'bakery', 'pastry',
      // Enseignes précises (marocaines/internationales) courantes sur les
      // relevés bancaires marocains, pas forcément couvertes par les termes
      // génériques ci-dessus.
      'mcdo', 'mcdonald', 'kfc', 'crusty', 'dominos', "domino's",
    ],
    categories: ['catering.fast_food'],
  },
  {
    // Livraison de repas — au Maroc, désigne quasi toujours de la
    // restauration livrée (Glovo fait aussi colis/courses, mais l'usage
    // dominant sur un relevé bancaire perso reste la commande de repas).
    // Volontairement une clé locale (voir LOCAL_ONLY_CATEGORY_HINTS), jamais
    // envoyée à Geoapify.
    keywords: ['glovo'],
    categories: ['local.food_delivery'],
  },
  { keywords: ['bar', 'pub', 'biergarten'], categories: ['catering.bar', 'catering.pub'] },
  { keywords: ['traiteur', 'buffet'], categories: ['catering.restaurant', 'catering.food_court'] },
  { keywords: ['pharmacie', 'pharmacy', 'parapharmacie'], categories: ['healthcare.pharmacy'] },
  { keywords: ['dentiste', 'dentist'], categories: ['healthcare.dentist'] },
  { keywords: ['clinique', 'clinic', 'medecin', 'docteur', 'doctor', 'cabinet medical'], categories: ['healthcare.clinic_or_praxis'] },
  {
    // Grandes surfaces / chaînes de supermarché présentes au Maroc + termes génériques.
    keywords: [
      'supermarche', 'supermarket', 'hypermarche', 'hypermarket', 'hyper u', 'epicerie',
      'superette', 'hanouty', 'alimentation generale', 'mini market', 'minimarket', 'proxi',
      'marjane', 'carrefour', 'aswak assalam', 'aswak', 'label vie', 'labelvie',
      'bim', 'atacadao', 'ultra', 'kariann', 'sodigrain', 'aina market',
    ],
    categories: ['commercial.supermarket', 'commercial.convenience'],
  },
  { keywords: ['boutique', 'vetement', 'clothing', 'fashion', 'pret a porter'], categories: ['commercial.clothing'] },
  { keywords: ['gym', 'fitness', 'salle de sport', 'musculation'], categories: ['sport.fitness', 'sport.sports_centre'] },
  { keywords: ['cinema'], categories: ['entertainment.cinema'] },
  { keywords: ['station', 'essence', 'gas', 'afriquia', 'shell', 'total', 'winxo', 'atlas essence'], categories: ['commercial.gas'] },
];

/**
 * Renvoie les catégories Geoapify suggérées par des mots-clés présents dans
 * le nom du marchand (ex: "norbelle cafe" -> ["catering.cafe"]).
 */
function inferCategoryHintsFromName(merchantName: string): string[] {
  const normalized = normalize(merchantName);
  const hints = new Set<string>();
  for (const { keywords, categories } of MERCHANT_KEYWORD_HINTS) {
    if (keywords.some((kw) => normalized.includes(kw))) {
      categories.forEach((c) => hints.add(c));
    }
  }
  return [...hints];
}

/**
 * Devine la catégorie directement à partir du nom du marchand, sans appeler
 * aucune API — gratuit et instantané. C'est la première chose qu'on essaie
 * (voir guessTransactionCategory) : Geoapify n'est appelé que si cette
 * passe locale échoue, pour rester sous le quota gratuit et répondre plus
 * vite. Retourne null si aucun mot-clé ne matche (nom pas assez explicite,
 * ex: "Norbelle" seul sans indice d'activité).
 */
export function guessCategoryFromMerchantName(merchantName?: string | null): PlaceCategoryGuess | null {
  if (!merchantName) return null;
  const hints = inferCategoryHintsFromName(merchantName);
  if (hints.length === 0) return null;

  const category = resolveCategory(hints);
  if (!category) return null;

  return { ...category, matchedPlaceName: merchantName };
}

const GEOAPIFY_URL = 'https://api.geoapify.com/v2/places';
const SEARCH_RADIUS_METERS = 120; // marge pour la dérive GPS en zone urbaine (immeubles, "canyon effect")
const FETCH_TIMEOUT_MS = 6000;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents (diacritiques combinants, forme NFD)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function namesLikelyMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

function resolveCategory(categories: string[]): { categoryName: string; subCategoryName?: string } | null {
  for (const cat of categories) {
    const match = GEOAPIFY_CATEGORY_TO_WEALTHOS[cat] ?? LOCAL_ONLY_CATEGORY_HINTS[cat];
    if (match) return match;
  }
  return null;
}

/**
 * Devine la catégorie d'une transaction à partir de coordonnées GPS et
 * (idéalement) du nom du marchand pour départager plusieurs commerces
 * proches. Retourne null si aucune correspondance fiable n'est trouvée, si
 * la clé API n'est pas configurée, ou en cas d'erreur réseau/timeout —
 * l'appelant doit alors garder son fallback habituel (Uncategorized).
 */
export async function guessCategoryFromLocation(params: {
  lat: number;
  lng: number;
  merchantName?: string | null;
}): Promise<PlaceCategoryGuess | null> {
  const { lat, lng, merchantName } = params;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) {
    console.warn('placeCategory: GEOAPIFY_API_KEY manquant dans .env — catégorisation par position désactivée.');
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const url = new URL(GEOAPIFY_URL);
    url.searchParams.set('categories', REQUESTED_CATEGORIES);
    url.searchParams.set('filter', `circle:${lng},${lat},${SEARCH_RADIUS_METERS}`);
    url.searchParams.set('bias', `proximity:${lng},${lat}`);
    url.searchParams.set('limit', '10');
    url.searchParams.set('apiKey', apiKey);

    const res = await fetch(url.toString(), { signal: controller.signal });

    if (!res.ok) {
      console.warn(`placeCategory: Geoapify a répondu ${res.status} — abandon.`);
      return null;
    }

    const data = (await res.json()) as GeoapifyResponse;
    const candidates = (data.features ?? []).filter((f) => f.properties?.name);
    if (candidates.length === 0) {
      console.log(`placeCategory: aucun commerce trouvé dans un rayon de ${SEARCH_RADIUS_METERS}m autour de (${lat}, ${lng}).`);
      return null;
    }

    // 1. On cherche d'abord une correspondance de nom avec le marchand
    //    envoyé par Apple Pay — c'est le signal le plus fiable.
    let chosen: GeoapifyFeature | undefined;
    let matchedByName = false;
    if (merchantName) {
      chosen = candidates.find((f) => namesLikelyMatch(f.properties!.name!, merchantName));
      matchedByName = Boolean(chosen);
    }

    const sortedByDistance = [...candidates].sort(
      (a, b) => (a.properties?.distance ?? Infinity) - (b.properties?.distance ?? Infinity),
    );

    // 2. À défaut, si le nom du marchand contient un mot-clé identifiable
    //    ("cafe", "pharmacie", "snack"...), on préfère le candidat le plus
    //    proche dont la catégorie correspond à ce mot-clé plutôt que de
    //    prendre le plus proche au hasard (utile quand plusieurs commerces
    //    de nature différente se trouvent dans le même rayon).
    let matchedByHint = false;
    if (!chosen && merchantName) {
      const hints = inferCategoryHintsFromName(merchantName);
      if (hints.length > 0) {
        chosen = sortedByDistance.find((f) => f.properties?.categories?.some((c) => hints.includes(c)));
        matchedByHint = Boolean(chosen);
      }
    }

    // 3. Sinon, on prend simplement le commerce le plus proche (bias=proximity
    //    trie déjà par distance, on retrie par sécurité sur
    //    `properties.distance` quand elle est présente).
    if (!chosen) {
      chosen = sortedByDistance[0];
    }

    if (!chosen?.properties) {
      console.log(`placeCategory: ${candidates.length} commerce(s) trouvé(s) mais aucun exploitable.`);
      return null;
    }

    if (!matchedByName) {
      const strategy = matchedByHint ? 'mot-clé du nom' : 'plus proche par défaut';
      console.log(
        `placeCategory: pas de correspondance exacte pour "${merchantName}" parmi ${candidates.length} commerce(s) (${candidates.map((c) => c.properties!.name).join(', ')}) — choix par ${strategy} : "${chosen.properties.name}" (${chosen.properties.distance ?? '?'}m).`,
      );
    }

    const category = resolveCategory(chosen.properties.categories ?? []);
    if (!category) {
      console.log(
        `placeCategory: match trouvé ("${chosen.properties.name}", catégories: ${(chosen.properties.categories ?? []).join(', ')}) mais pas de mapping vers une catégorie WealthOS — à ajouter dans GEOAPIFY_CATEGORY_TO_WEALTHOS si pertinent.`,
      );
      return null;
    }

    return { ...category, matchedPlaceName: chosen.properties.name! };
  } catch (err) {
    // Timeout, erreur réseau, JSON invalide... on ne bloque jamais la
    // création de la transaction pour ça.
    console.warn('placeCategory: erreur pendant la requête Geoapify —', err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Point d'entrée à utiliser côté webhook : essaie d'abord de deviner la
 * catégorie à partir du seul nom du marchand (gratuit, instantané, aucun
 * appel réseau). N'appelle Geoapify que si cette première passe échoue
 * (nom pas assez explicite, ex: "Norbelle" sans indice d'activité) — ça
 * garde la consommation du quota gratuit Geoapify (3000/jour) au minimum et
 * évite un aller-retour réseau pour les cas déjà évidents ("KFC",
 * "Marjane Massira", "Pharmacie Al Andalous"...).
 */
export async function guessTransactionCategory(params: {
  merchantName?: string | null;
  lat: number | null;
  lng: number | null;
}): Promise<PlaceCategoryGuess | null> {
  const { merchantName, lat, lng } = params;

  const fromName = guessCategoryFromMerchantName(merchantName);
  if (fromName) {
    console.log(
      `placeCategory: catégorie devinée directement depuis le nom du marchand ("${merchantName}") -> ${fromName.categoryName}${fromName.subCategoryName ? ` / ${fromName.subCategoryName}` : ''} — Geoapify non appelé.`,
    );
    return fromName;
  }

  if (lat === null || lng === null) return null;

  return guessCategoryFromLocation({ lat, lng, merchantName });
}
