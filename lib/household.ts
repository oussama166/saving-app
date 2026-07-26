import { prisma } from '@/lib/prisma';

// Foyer partagé (couple/famille, max 2 membres) — voir prisma/schema.prisma
// pour le détail des modèles (Household/HouseholdMember/HouseholdInvite).
//
// Deux notions distinctes utilisées dans tout le reste du code :
// - `memberIds` : élargit la VISIBILITÉ en lecture (et les cibles de
//   modification/suppression) à tous les membres du foyer, pour tout ce qui
//   reste attribué à qui l'a créé (comptes, transactions, objectifs,
//   abonnements, dettes...). Une création garde toujours l'id de
//   l'utilisateur agissant, jamais élargie.
// - `budgetOwnerId` : LE propriétaire canonique du budget (Category,
//   UserSettings) — un seul jeu de catégories/% pour tout le foyer plutôt
//   que deux configurations concurrentes. Les lectures ET les créations sur
//   ces deux modèles doivent utiliser cet id, pas celui de l'utilisateur
//   agissant.
//
// Sans foyer (cas par défaut, immense majorité des comptes), les deux
// valeurs retombent simplement sur l'utilisateur lui-même — comportement
// strictement identique à avant cette fonctionnalité.
export interface HouseholdContext {
  householdId: string | null;
  memberIds: string[];
  budgetOwnerId: string;
}

export async function getHouseholdContext(userId: string): Promise<HouseholdContext> {
  const membership = await prisma.householdMember.findUnique({
    where: { userId },
    include: { household: { include: { members: true } } },
  });

  if (!membership) {
    return { householdId: null, memberIds: [userId], budgetOwnerId: userId };
  }

  const memberIds = membership.household.members.map((m) => m.userId);
  const budgetOwner = membership.household.members.find((m) => m.isBudgetOwner);

  return {
    householdId: membership.householdId,
    memberIds,
    budgetOwnerId: budgetOwner?.userId ?? userId,
  };
}

/** Raccourci pour les call sites qui n'ont besoin que de la liste de membres. */
export async function getHouseholdMemberIds(userId: string): Promise<string[]> {
  return (await getHouseholdContext(userId)).memberIds;
}

/** Raccourci pour les call sites qui n'ont besoin que du propriétaire budget. */
export async function getBudgetOwnerUserId(userId: string): Promise<string> {
  return (await getHouseholdContext(userId)).budgetOwnerId;
}

const MAX_HOUSEHOLD_MEMBERS = 2;

/**
 * Détails complets du foyer d'un utilisateur pour l'UI (page Profil) :
 * membres (avec email/nom), invitations en attente qu'il a envoyées. Null si
 * l'utilisateur n'est dans aucun foyer.
 */
export async function getHouseholdDetails(userId: string) {
  const membership = await prisma.householdMember.findUnique({
    where: { userId },
    include: {
      household: {
        include: {
          members: { include: { user: { select: { id: true, email: true, name: true } } } },
          invites: { where: { status: 'pending' } },
        },
      },
    },
  });

  if (!membership) return null;

  return {
    householdId: membership.householdId,
    isFull: membership.household.members.length >= MAX_HOUSEHOLD_MEMBERS,
    members: membership.household.members.map((m) => ({
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      isBudgetOwner: m.isBudgetOwner,
      isSelf: m.userId === userId,
    })),
    pendingInvites: membership.household.invites.map((i) => ({
      id: i.id,
      email: i.email,
      expiresAt: i.expiresAt,
    })),
  };
}

export { MAX_HOUSEHOLD_MEMBERS };
