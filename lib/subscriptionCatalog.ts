// Catalogue de services d'abonnement populaires, pour accélérer la saisie
// dans la page Abonnements (voir app/abonnements/page.tsx). Chaque entrée a
// un nom, une sous-catégorie suggérée (texte libre, même pattern que
// Transaction.subCategory), un style (icône lucide-react + couleur Tailwind)
// et une liste de "plans" (formules existantes du service, ex: Netflix
// Essential/Standard/Premium) avec un prix MAD/mois par défaut chacune —
// affichée comme dropdown dans le formulaire, pré-remplissant le prix.
// L'utilisateur reste libre d'ajuster le prix après sélection, et peut
// toujours choisir "Personnalisé" pour un abonnement hors catalogue.
//
// Prix recherchés le 16/07/2026, en MAD/mois (approximatifs — promos,
// changements de plan et taux de change font varier ces montants ; à
// ajuster librement dans le formulaire) :
// - Netflix, Spotify, YouTube Premium, Google One (100 Go), Disney+ : prix
//   officiels du store marocain trouvés directement.
// - PlayStation Plus (Essential/Extra/Deluxe) : prix courants chez les
//   revendeurs marocains (pas de store PSN en MAD natif à proprement parler).
// - Xbox Game Pass (Essential/PC/Ultimate), Apple Music (Étudiant/Individuel/
//   Famille), Deezer, Canva Pro, ChatGPT (Plus/Pro), Apple TV+, Amazon Prime
//   Video, iCloud+ : pas de tarif MAD officiel trouvé — converti depuis le
//   prix USD/EUR officiel (taux ~9,34 MAD/USD, ~10,85 MAD/EUR) ou estimé à
//   partir des ratios de prix Google One/iCloud+ globaux quand la donnée MA
//   n'existe pas.
export interface SubscriptionPlan {
  label: string;
  price: number; // MAD/mois, approximatif — voir commentaire ci-dessus
}

export interface SubscriptionCatalogEntry {
  key: string;
  name: string;
  suggestedSubCategory: string;
  plans: SubscriptionPlan[]; // toujours au moins 1 entrée
  icon: 'video' | 'music' | 'gamepad' | 'cloud' | 'sparkles';
  color: string; // classe Tailwind (bg + text), voir SUBSCRIPTION_ICON_STYLES
}

export const SUBSCRIPTION_CATALOG: SubscriptionCatalogEntry[] = [
  {
    key: 'netflix',
    name: 'Netflix',
    suggestedSubCategory: 'Streaming Vidéo',
    icon: 'video',
    color: 'red',
    plans: [
      { label: 'Essentiel', price: 35 },
      { label: 'Standard', price: 65 },
      { label: 'Premium', price: 95 },
    ],
  },
  {
    key: 'primevideo',
    name: 'Amazon Prime Video',
    suggestedSubCategory: 'Streaming Vidéo',
    icon: 'video',
    color: 'blue',
    plans: [{ label: 'Standard', price: 55 }],
  },
  {
    key: 'disneyplus',
    name: 'Disney+',
    suggestedSubCategory: 'Streaming Vidéo',
    icon: 'video',
    color: 'indigo',
    plans: [{ label: 'Standard', price: 33 }],
  },
  {
    key: 'appletv',
    name: 'Apple TV+',
    suggestedSubCategory: 'Streaming Vidéo',
    icon: 'video',
    color: 'neutral',
    plans: [{ label: 'Standard', price: 95 }],
  },
  {
    key: 'youtubepremium',
    name: 'YouTube Premium',
    suggestedSubCategory: 'Streaming Vidéo',
    icon: 'video',
    color: 'red',
    plans: [
      { label: 'Individuel', price: 60 },
      { label: 'Famille', price: 110 },
    ],
  },
  {
    key: 'spotify',
    name: 'Spotify',
    suggestedSubCategory: 'Musique',
    icon: 'music',
    color: 'green',
    plans: [
      { label: 'Étudiant', price: 23 },
      { label: 'Individuel', price: 45 },
      { label: 'Duo', price: 60 },
      { label: 'Famille', price: 75 },
    ],
  },
  {
    key: 'applemusic',
    name: 'Apple Music',
    suggestedSubCategory: 'Musique',
    icon: 'music',
    color: 'pink',
    plans: [
      { label: 'Étudiant', price: 56 },
      { label: 'Individuel', price: 103 },
      { label: 'Famille', price: 159 },
    ],
  },
  {
    key: 'deezer',
    name: 'Deezer',
    suggestedSubCategory: 'Musique',
    icon: 'music',
    color: 'orange',
    plans: [{ label: 'Premium', price: 105 }],
  },
  {
    key: 'psplus',
    name: 'PlayStation Plus',
    suggestedSubCategory: 'Jeux Vidéo',
    icon: 'gamepad',
    color: 'blue',
    plans: [
      { label: 'Essential', price: 160 },
      { label: 'Extra', price: 199 },
      { label: 'Deluxe/Premium', price: 230 },
    ],
  },
  {
    key: 'xboxgamepass',
    name: 'Xbox Game Pass',
    suggestedSubCategory: 'Jeux Vidéo',
    icon: 'gamepad',
    color: 'green',
    plans: [
      { label: 'Essential (Core)', price: 95 },
      { label: 'PC', price: 140 },
      { label: 'Ultimate', price: 230 },
    ],
  },
  {
    key: 'icloud',
    name: 'iCloud+',
    suggestedSubCategory: 'Cloud & Stockage',
    icon: 'cloud',
    color: 'neutral',
    plans: [
      { label: '50 Go', price: 9 },
      { label: '200 Go', price: 28 },
      { label: '2 To', price: 93 },
    ],
  },
  {
    key: 'googleone',
    name: 'Google One',
    suggestedSubCategory: 'Cloud & Stockage',
    icon: 'cloud',
    color: 'blue',
    plans: [
      { label: '100 Go', price: 50 },
      { label: '200 Go', price: 75 },
      { label: '2 To', price: 250 },
    ],
  },
  {
    key: 'canva',
    name: 'Canva Pro',
    suggestedSubCategory: 'Productivité',
    icon: 'sparkles',
    color: 'purple',
    plans: [{ label: 'Pro (individuel)', price: 140 }],
  },
  {
    key: 'chatgpt',
    name: 'ChatGPT',
    suggestedSubCategory: 'Productivité',
    icon: 'sparkles',
    color: 'teal',
    plans: [
      { label: 'Plus', price: 190 },
      { label: 'Pro', price: 1870 },
    ],
  },
];

export function findCatalogEntry(key: string | null | undefined): SubscriptionCatalogEntry | undefined {
  if (!key) return undefined;
  return SUBSCRIPTION_CATALOG.find((e) => e.key === key);
}

// Classes Tailwind par couleur — regroupées ici plutôt qu'en template string
// dynamique (`bg-${color}-600/20`) pour que Tailwind détecte statiquement
// les classes utilisées (le JIT ne scanne pas les templates interpolés).
export const SUBSCRIPTION_ICON_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  red: { bg: 'bg-red-600/20', border: 'border-red-500/20', text: 'text-red-400' },
  blue: { bg: 'bg-blue-600/20', border: 'border-blue-500/20', text: 'text-blue-400' },
  indigo: { bg: 'bg-indigo-600/20', border: 'border-indigo-500/20', text: 'text-indigo-400' },
  green: { bg: 'bg-emerald-600/20', border: 'border-emerald-500/20', text: 'text-emerald-400' },
  pink: { bg: 'bg-pink-600/20', border: 'border-pink-500/20', text: 'text-pink-400' },
  orange: { bg: 'bg-orange-600/20', border: 'border-orange-500/20', text: 'text-orange-400' },
  purple: { bg: 'bg-purple-600/20', border: 'border-purple-500/20', text: 'text-purple-400' },
  teal: { bg: 'bg-teal-600/20', border: 'border-teal-500/20', text: 'text-teal-400' },
  neutral: { bg: 'bg-neutral-600/20', border: 'border-neutral-500/20', text: 'text-neutral-400' },
};
