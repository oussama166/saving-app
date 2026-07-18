import type { PrismaClient } from '@prisma/client';

// -----------------------------------------------------------------------------
// Catégories budgétaires par défaut (les 13 du site 1, budgetPct doit sommer à
// 100 hors catégorie "income"). Créées automatiquement pour chaque nouveau
// compte à l'inscription (voir seedDefaultsForUser ci-dessous), plutôt que
// via un seed global comme avant le passage au multi-utilisateur.
// -----------------------------------------------------------------------------
export const DEFAULT_CATEGORIES: {
  name: string;
  type: 'expense' | 'savings' | 'income';
  order: number;
  budgetPct: number;
  subCategories: string[];
}[] = [
  {
    name: 'Logement & Charges',
    type: 'expense',
    order: 1,
    budgetPct: 30,
    subCategories: ['Loyer', 'Eau & Électricité', 'Gaz', 'Internet & Téléphone', 'Syndic/Charges', 'Entretien Logement'],
  },
  {
    name: 'Alimentation & Restauration',
    type: 'expense',
    order: 2,
    budgetPct: 12,
    subCategories: ['Restaurant', 'Épicerie/Courses', 'Café / Fast-food', 'Livraison à domicile'],
  },
  {
    name: 'Transport & Mobilité',
    type: 'expense',
    order: 3,
    budgetPct: 6,
    subCategories: ['Taxi/Uber', 'Carburant', 'Transport en commun', 'Entretien Véhicule'],
  },
  {
    name: 'Santé & Médical',
    type: 'expense',
    order: 4,
    budgetPct: 4,
    subCategories: ['Médecin Généraliste', 'Pharmacie/Médicaments', 'Dentiste', 'Analyses/Labo'],
  },
  {
    name: 'Éducation & Développement',
    type: 'expense',
    order: 5,
    budgetPct: 4,
    subCategories: ['Formation en ligne (Coursera/Udemy)', 'Livres', 'Certifications'],
  },
  {
    name: 'Loisirs & Divertissement',
    type: 'expense',
    order: 6,
    budgetPct: 6,
    subCategories: ['Sport & Fitness', 'Cinéma/Sorties', 'Voyages courts'],
  },
  {
    name: 'Shopping & Vêtements',
    type: 'expense',
    order: 7,
    budgetPct: 3,
    subCategories: ['Vêtements & Chaussures', 'Électroménager', 'Accessoires'],
  },
  {
    name: 'Tech & Abonnements',
    type: 'expense',
    order: 8,
    budgetPct: 2,
    subCategories: ['Netflix/Disney+', 'Applications/Logiciels', 'Matériel Informatique'],
  },
  {
    name: 'Famille & Entraide',
    type: 'expense',
    order: 9,
    budgetPct: 3,
    subCategories: ['Aide Famille', 'Cadeaux', 'Événements familiaux'],
  },
  {
    name: 'Épargne Sécurité',
    type: 'savings',
    order: 10,
    budgetPct: 5,
    subCategories: ["Fonds d'Urgence", 'Virement Automatique'],
  },
  {
    name: 'Épargne Projets',
    type: 'savings',
    order: 11,
    budgetPct: 5,
    subCategories: ['Projet Voyage', 'Apport Immobilier', 'Fonds Business'],
  },
  {
    name: 'Investissements & Trading',
    type: 'savings',
    order: 12,
    budgetPct: 12,
    subCategories: ['Crypto (BTC/ETH/SOL)', 'ETF Internationaux', 'Actions MASI', 'OPCVM'],
  },
  {
    name: 'Divers & Imprévus',
    type: 'expense',
    order: 13,
    budgetPct: 8,
    subCategories: ['Réparations', 'Amendes', 'Imprévus divers'],
  },
  {
    // Nécessaire pour que le sélecteur "Revenu (+)" du formulaire de saisie ait
    // une catégorie valide à assigner. Hors des 100% d'allocation (budgetPct = 0).
    name: 'Revenus (Salaire/Freelance)',
    type: 'income',
    order: 0,
    budgetPct: 0,
    subCategories: ['Salaire Net', 'Freelance/Mission'],
  },
];

export const PAYMENT_METHODS = [
  'Carte Bancaire',
  'Virement Bancaire',
  'Espèces',
  'Chèque',
  'CIH Pay/Mobile',
  'PayPal',
  'Apple Pay',
  'BMCE DIRECT',
];

/**
 * Crée les catégories/sous-catégories par défaut, le compte "Main Checking"
 * et UserSettings pour un utilisateur donné. Appelée automatiquement à
 * l'inscription (app/api/auth/signup/route.ts). Idempotente : si les
 * catégories existent déjà pour cet utilisateur (par nom), elles sont mises
 * à jour plutôt que dupliquées — utile si on relance le seed manuellement.
 *
 * Écrit en batch (createMany) plutôt qu'en ~60 allers-retours séquentiels
 * un par un : la version d'origine (une create/update par catégorie ET par
 * sous-catégorie) faisait ~13 + ~45 requêtes réseau individuelles, ce qui
 * est négligeable contre un fichier SQLite local mais peut dépasser le
 * timeout d'une fonction serverless Vercel contre une base distante Turso.
 *
 * Volontairement SANS `$transaction(async (tx) => ...)` (transaction
 * interactive) : l'adapter Prisma pour libSQL/Turso a des soucis de
 * fiabilité connus avec les transactions interactives à distance (erreurs
 * "TRANSACTION_CLOSED", voir prisma/prisma#21345) — une première version de
 * cette fonction utilisait ce mécanisme et échouait silencieusement contre
 * Turso, laissant les comptes non seedés malgré le correctif. Chaque étape
 * ci-dessous est idempotente (vérifiée par nom avant insertion), donc un
 * échec partiel est sans danger : ensureUserSeeded() rattrape le reste au
 * prochain appel plutôt que de dépendre d'une atomicité tout-ou-rien.
 */
export async function seedDefaultsForUser(prisma: PrismaClient, userId: string) {
  const total = DEFAULT_CATEGORIES.filter((c) => c.type !== 'income').reduce((acc, c) => acc + c.budgetPct, 0);
  if (total !== 100) {
    throw new Error(`Les budgetPct des catégories par défaut somment à ${total}%, pas 100%. Seed annulé.`);
  }

  const existingCategories = await prisma.category.findMany({
    where: { userId, name: { in: DEFAULT_CATEGORIES.map((c) => c.name) } },
    select: { id: true, name: true },
  });
  const existingByName = new Map(existingCategories.map((c) => [c.name, c]));

  const toCreate = DEFAULT_CATEGORIES.filter((d) => !existingByName.has(d.name));
  const toUpdate = DEFAULT_CATEGORIES.filter((d) => existingByName.has(d.name));

  if (toUpdate.length > 0) {
    await Promise.all(
      toUpdate.map((def) => {
        const existing = existingByName.get(def.name)!;
        return prisma.category.update({
          where: { id: existing.id },
          data: { type: def.type, order: def.order, budgetPct: def.budgetPct },
        });
      }),
    );
  }

  if (toCreate.length > 0) {
    // createMany (pas createManyAndReturn) : la clause RETURNING n'est pas
    // garantie fiable sur tous les chemins de l'adapter libSQL — on relit
    // juste après via un findMany classique, universellement supporté.
    await prisma.category.createMany({
      data: toCreate.map((def) => ({
        userId,
        name: def.name,
        type: def.type,
        order: def.order,
        budgetPct: def.budgetPct,
      })),
    });
  }

  const allCategories = await prisma.category.findMany({
    where: { userId, name: { in: DEFAULT_CATEGORIES.map((c) => c.name) } },
    select: { id: true, name: true },
  });
  const categoryIdByName = new Map(allCategories.map((c) => [c.name, c.id]));

  const allCategoryIds = [...categoryIdByName.values()];
  const existingSubs = allCategoryIds.length
    ? await prisma.subCategory.findMany({
        where: { categoryId: { in: allCategoryIds } },
        select: { categoryId: true, name: true },
      })
    : [];
  const existingSubKeys = new Set(existingSubs.map((s) => `${s.categoryId}::${s.name}`));

  const subsToCreate: { name: string; categoryId: string }[] = [];
  for (const def of DEFAULT_CATEGORIES) {
    const categoryId = categoryIdByName.get(def.name);
    if (!categoryId) continue;
    for (const subName of def.subCategories) {
      if (!existingSubKeys.has(`${categoryId}::${subName}`)) {
        subsToCreate.push({ name: subName, categoryId });
      }
    }
  }

  if (subsToCreate.length > 0) {
    await prisma.subCategory.createMany({ data: subsToCreate });
  }

  await prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId, referenceIncome: 10000, currency: 'MAD', emergencyFundTargetMonths: 3 },
  });

  const existingAccount = await prisma.account.findFirst({ where: { userId, name: 'Main Checking' } });
  if (!existingAccount) {
    await prisma.account.create({ data: { userId, name: 'Main Checking', type: 'checking', balance: 0 } });
  }
}

/**
 * Filet de sécurité pour les comptes créés avant ce correctif (ou dont le
 * seed a échoué en cours de route, ex: timeout réseau contre Turso) : si
 * l'utilisateur n'a aucune catégorie, relance le seed. Un simple COUNT
 * indexé par userId, appelé depuis les routes qui dépendent des catégories
 * (paramètres, budget réel) — coût négligeable, et no-op dès que le compte
 * est correctement seedé.
 *
 * N'importe jamais d'exception vers l'appelant : si le seed échoue encore
 * (panne Turso, etc.), la route continue de répondre normalement (avec 0
 * catégorie, comme avant) plutôt que de renvoyer un 500 générique qui
 * masquerait complètement l'erreur côté client. L'erreur reste visible
 * dans les logs serveur (Vercel → Functions → Logs) pour diagnostic.
 */
export async function ensureUserSeeded(prisma: PrismaClient, userId: string) {
  try {
    const count = await prisma.category.count({ where: { userId } });
    if (count === 0) {
      await seedDefaultsForUser(prisma, userId);
    }
  } catch (error) {
    console.error(`ensureUserSeeded a échoué pour userId=${userId}:`, error);
  }
}
