import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// Cascade de suppression complète d'un compte utilisateur et de TOUTES ses
// données financières. Extrait de app/api/auth/me/route.ts (DELETE) pour être
// réutilisé par le panel admin (suppression d'un compte par un admin) sans
// dupliquer l'ordre de suppression, qui doit respecter les contraintes FK
// (RESTRICT par défaut chez Prisma) : les tables qui référencent d'autres
// tables doivent être vidées avant celles qu'elles référencent.
//
// deleteUserDataInTx prend un Prisma.TransactionClient existant (permet à
// l'appelant de regrouper cette suppression avec d'autres opérations dans la
// même transaction, ex: écrire un log d'audit admin). deleteUserAccount est
// le wrapper public qui ouvre sa propre transaction pour l'usage simple.
export async function deleteUserDataInTx(tx: Prisma.TransactionClient, userId: string) {
  const categories = await tx.category.findMany({ where: { userId }, select: { id: true } });
  const categoryIds = categories.map((c) => c.id);

  // Ordre : les tables qui référencent Transaction/Category/Account d'abord,
  // puis Category/Account, puis User en dernier. Subscription est supprimée
  // après Transaction (qui peut la référencer via subscriptionId) mais avant
  // Category/Account (qu'elle référence). GoalContribution et DebtPayment
  // référencent Transaction, donc doivent partir avant elle (DebtPayment
  // référence aussi Debt, donc avant lui aussi). SubscriptionPlanChange
  // référence Subscription (RESTRICT), donc doit partir avant elle.
  // BudgetAlertSent référence Category (RESTRICT), donc avant elle aussi.
  await tx.goalContribution.deleteMany({ where: { userId } });
  await tx.debtPayment.deleteMany({ where: { userId } });
  await tx.medicalRecord.deleteMany({ where: { userId } });
  await tx.transaction.deleteMany({ where: { userId } });
  await tx.subscriptionPlanChange.deleteMany({ where: { userId } });
  await tx.subscription.deleteMany({ where: { userId } });
  await tx.debt.deleteMany({ where: { userId } });
  await tx.portfolioAsset.deleteMany({ where: { userId } });
  await tx.savingsGoal.deleteMany({ where: { userId } });
  await tx.budgetAlertSent.deleteMany({ where: { userId } });
  await tx.subCategory.deleteMany({ where: { categoryId: { in: categoryIds } } });
  await tx.categoryArchive.deleteMany({ where: { categoryId: { in: categoryIds } } });
  await tx.category.deleteMany({ where: { userId } });
  await tx.account.deleteMany({ where: { userId } });
  await tx.userSettings.deleteMany({ where: { userId } });
  await tx.aiAdviceCache.deleteMany({ where: { userId } });

  // Foyer partagé (voir lib/household.ts) : max 2 membres, donc retirer
  // n'importe quel membre laisse au plus 1 personne — un foyer "à 1" n'a pas
  // de sens (équivalent à pas de foyer du tout), donc on le dissout
  // entièrement plutôt que de laisser l'autre membre dans un état bancal.
  // Les invitations (HouseholdInvite, référencent invitedByUserId en
  // RESTRICT) partent avec le foyer, quel que soit qui les a envoyées.
  const membership = await tx.householdMember.findUnique({ where: { userId }, select: { householdId: true } });
  if (membership) {
    await tx.householdInvite.deleteMany({ where: { householdId: membership.householdId } });
    await tx.householdMember.deleteMany({ where: { householdId: membership.householdId } });
    await tx.household.delete({ where: { id: membership.householdId } });
  } else {
    // Pas dans un foyer, mais peut avoir envoyé des invitations depuis un
    // foyer dont il n'est plus membre (cas impossible dans le flux normal
    // actuel, gardé par sécurité pour ne jamais laisser une FK orpheline).
    await tx.householdInvite.deleteMany({ where: { invitedByUserId: userId } });
  }

  await tx.user.delete({ where: { id: userId } });
}

export async function deleteUserAccount(userId: string) {
  await prisma.$transaction((tx) => deleteUserDataInTx(tx, userId));
}
