import { prisma } from '@/lib/prisma';

// Registre des sections/fonctionnalités que l'admin peut activer/désactiver
// globalement (voir app/admin/features) — une entrée = une clé stable
// utilisée dans le code (jamais renommée après coup, sous peine de perdre le
// lien avec la ligne Feature déjà en base) + un libellé/description affichés
// dans l'admin. `parentKey` est purement organisationnel (regroupement
// visuel dans l'admin + affichage "inline" au lieu de pleine page côté
// utilisateur) — voir le commentaire sur Feature.parentKey dans
// schema.prisma. Une entrée sans parentKey est une SECTION (page entière,
// gérée par <FeatureGate>/vérifiée en page serveur) ; une entrée avec
// parentKey est une SOUS-fonctionnalité (un bloc précis à l'intérieur d'une
// page qui reste par ailleurs accessible, gérée par
// <FeatureDisabledInlineCard>).
export interface FeatureDefinition {
  key: string;
  name: string;
  description: string;
  parentKey?: string;
}

export const FEATURE_REGISTRY: FeatureDefinition[] = [
  { key: 'dashboard', name: 'Dashboard', description: "Vue d'ensemble (soldes, budget 50/30/20, visualisations)." },
  { key: 'transactions', name: 'Saisie & Historique', description: 'Saisie manuelle, import CSV, scan de reçu (OCR), historique des transactions.' },
  { key: 'portfolio', name: 'Portfolio & Épargne', description: 'Suivi des actifs (crypto, actions, OPCVM...), trades.' },
  { key: 'goals', name: 'Objectifs', description: "Objectifs d'épargne et contributions." },
  { key: 'analytics', name: 'Analyse & Tendances', description: 'Historique mensuel, ratios financiers, tendances par catégorie.' },
  { key: 'health', name: 'Santé', description: 'Budget santé, remboursements, dossiers médicaux.' },
  { key: 'coach', name: 'Coach IA', description: 'Diagnostic, règles d\'or, benchmarks, chat avec le coach IA.' },
  { key: 'zakat', name: 'Zakat', description: 'Calcul de la zakat sur le patrimoine.' },
  { key: 'subscriptions', name: 'Abonnements', description: 'Abonnements récurrents (Netflix, Spotify...).' },
  { key: 'debts', name: 'Dettes & Prêts', description: 'Suivi des dettes et remboursements.' },
  { key: 'profile', name: 'Profil & Réglages', description: 'Réglages, sécurité (2FA), foyer partagé, comptes, export de rapports.' },

  // Sous-fonctionnalités de "Profil & Réglages" — chacune activable/
  // désactivable indépendamment de la page elle-même (voir
  // app/profil/page.tsx). Désactiver la section "profile" ci-dessus bloque
  // toute la page ; désactiver une seule de ces sous-clés ne masque que le
  // bloc correspondant.
  { key: 'profile.budget_allocation', name: 'Allocation budgétaire (50/30/20)', description: 'Éditeur des pourcentages de budget par catégorie + optimiseur basé sur le réel.', parentKey: 'profile' },
  { key: 'profile.export_excel', name: 'Export Bilan Excel', description: 'Génération du bilan financier complet au format .xlsx.', parentKey: 'profile' },
  { key: 'profile.export_pdf', name: 'Export Bilan PDF', description: 'Génération du résumé imprimable au format PDF.', parentKey: 'profile' },
  { key: 'profile.account_security', name: 'Sécurité du compte', description: 'Modification nom/email, changement de mot de passe, suppression de compte.', parentKey: 'profile' },
  { key: 'profile.two_factor', name: 'Authentification à deux facteurs', description: 'Activation/désactivation du 2FA (TOTP).', parentKey: 'profile' },
  { key: 'profile.household', name: 'Foyer partagé', description: 'Invitations et gestion du budget partagé à deux.', parentKey: 'profile' },
  { key: 'profile.accounts', name: 'Comptes bancaires (multi-devises)', description: 'Création/renommage/suppression des comptes, devises étrangères.', parentKey: 'profile' },
  { key: 'profile.webhook_token', name: 'Token Webhook (iOS Shortcut)', description: 'Génération du token utilisé par les Shortcuts Apple Pay / Salaire.', parentKey: 'profile' },
];

const FEATURE_KEY_SET = new Set(FEATURE_REGISTRY.map((f) => f.key));

const DEFAULT_DISABLED_MESSAGE = "Cette fonctionnalité est temporairement désactivée. Contacte l'administrateur si tu penses que c'est une erreur.";

/**
 * Crée en base les Feature du registre qui n'existent pas encore (idempotent,
 * activées par défaut) — appelé au chargement de la page Admin >
 * Fonctionnalités plutôt que via une migration de données séparée, pour
 * rester à jour automatiquement si de nouvelles clés sont ajoutées au
 * registre plus tard sans avoir à écrire une nouvelle migration à chaque
 * fois.
 */
export async function ensureFeaturesSeeded(): Promise<void> {
  const existing = await prisma.feature.findMany({ select: { key: true } });
  const existingKeys = new Set(existing.map((f) => f.key));
  const missing = FEATURE_REGISTRY.filter((f) => !existingKeys.has(f.key));
  if (missing.length === 0) return;

  await prisma.$transaction(
    missing.map((f) =>
      prisma.feature.create({ data: { key: f.key, name: f.name, description: f.description, parentKey: f.parentKey ?? null } }),
    ),
  );
}

/**
 * Vérifie si `userId` a accès à la fonctionnalité `featureKey`. "Fail-open" :
 * si la clé n'a pas (encore) de ligne Feature en base, l'accès est autorisé
 * — on ne bloque jamais une fonctionnalité par défaut simplement parce que
 * personne n'a encore ouvert la page Admin > Fonctionnalités pour la seeder.
 * Un admin doit explicitement désactiver une fonctionnalité pour qu'elle se
 * mette à bloquer qui que ce soit.
 */
export async function isFeatureEnabledForUser(featureKey: string, userId: string): Promise<boolean> {
  const feature = await prisma.feature.findUnique({ where: { key: featureKey } });
  if (!feature) return true;
  if (feature.enabled) return true;

  const grant = await prisma.featureAccessGrant.findUnique({
    where: { featureKey_userId: { featureKey, userId } },
  });
  return Boolean(grant);
}

export interface FeatureStatus {
  allowed: boolean;
  message: string | null; // uniquement pertinent quand allowed = false ; message custom de l'admin ou texte générique par défaut
}

/**
 * Version "batch" de isFeatureEnabledForUser pour une page qui a besoin de
 * vérifier plusieurs sous-fonctionnalités à la fois (ex: app/profil/page.tsx
 * et ses 8 cartes) — une seule requête pour les Feature + une seule pour les
 * FeatureAccessGrant de l'utilisateur, plutôt qu'un aller-retour DB par clé.
 * Une clé absente du registre ou de la base est traitée comme autorisée
 * (même politique fail-open que isFeatureEnabledForUser).
 */
export async function getFeatureStatusesForUser(
  featureKeys: string[],
  userId: string,
): Promise<Record<string, FeatureStatus>> {
  if (featureKeys.length === 0) return {};

  const [features, grants] = await Promise.all([
    prisma.feature.findMany({ where: { key: { in: featureKeys } } }),
    prisma.featureAccessGrant.findMany({ where: { userId, featureKey: { in: featureKeys } }, select: { featureKey: true } }),
  ]);
  const featureByKey = new Map(features.map((f) => [f.key, f]));
  const grantedKeys = new Set(grants.map((g) => g.featureKey));

  const result: Record<string, FeatureStatus> = {};
  for (const key of featureKeys) {
    const feature = featureByKey.get(key);
    if (!feature || feature.enabled || grantedKeys.has(key)) {
      result[key] = { allowed: true, message: null };
    } else {
      result[key] = { allowed: false, message: feature.customMessage?.trim() || DEFAULT_DISABLED_MESSAGE };
    }
  }
  return result;
}

/**
 * Version singulière de getFeatureStatusesForUser, pour les pages serveur
 * qui ne vérifient qu'une seule fonctionnalité (les 5 pages serveur — voir
 * app/saisie, portfolio, objectifs, analyse, sante/page.tsx) et ont besoin
 * du message custom en plus du booléen pour l'afficher via
 * <FeatureDisabledNotice message={...} />.
 */
export async function getFeatureStatusForUser(featureKey: string, userId: string): Promise<FeatureStatus> {
  const statuses = await getFeatureStatusesForUser([featureKey], userId);
  return statuses[featureKey] ?? { allowed: true, message: null };
}

/**
 * Variante "throw" pour les routes API — à appeler juste après
 * requireSession()/requireWebhookAuth(), même convention que les autres
 * erreurs métier de l'app (catch sur error.message dans le route handler).
 * Lève 'FEATURE_DISABLED' si l'accès est refusé.
 */
export async function requireFeatureAccess(featureKey: string, userId: string): Promise<void> {
  const allowed = await isFeatureEnabledForUser(featureKey, userId);
  if (!allowed) {
    throw new Error('FEATURE_DISABLED');
  }
}

export function isKnownFeatureKey(key: string): boolean {
  return FEATURE_KEY_SET.has(key);
}

export { DEFAULT_DISABLED_MESSAGE };
