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
 */
export async function seedDefaultsForUser(prisma: PrismaClient, userId: string) {
  const total = DEFAULT_CATEGORIES.filter((c) => c.type !== 'income').reduce((acc, c) => acc + c.budgetPct, 0);
  if (total !== 100) {
    throw new Error(`Les budgetPct des catégories par défaut somment à ${total}%, pas 100%. Seed annulé.`);
  }

  for (const def of DEFAULT_CATEGORIES) {
    let category = await prisma.category.findFirst({ where: { userId, name: def.name } });

    if (category) {
      category = await prisma.category.update({
        where: { id: category.id },
        data: { type: def.type, order: def.order, budgetPct: def.budgetPct },
      });
    } else {
      category = await prisma.category.create({
        data: { userId, name: def.name, type: def.type, order: def.order, budgetPct: def.budgetPct },
      });
    }

    for (const subName of def.subCategories) {
      const existingSub = await prisma.subCategory.findFirst({
        where: { categoryId: category.id, name: subName },
      });
      if (!existingSub) {
        await prisma.subCategory.create({ data: { name: subName, categoryId: category.id } });
      }
    }
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
