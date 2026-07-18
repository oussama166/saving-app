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
  // Category/Account (qu'elle référence). GoalContribution référence à la
  // fois Transaction et SavingsGoal, donc doit partir avant les deux.
  await tx.goalContribution.deleteMany({ where: { userId } });
  await tx.medicalRecord.deleteMany({ where: { userId } });
  await tx.transaction.deleteMany({ where: { userId } });
  await tx.subscription.deleteMany({ where: { userId } });
  await tx.portfolioAsset.deleteMany({ where: { userId } });
  await tx.savingsGoal.deleteMany({ where: { userId } });
  await tx.subCategory.deleteMany({ where: { categoryId: { in: categoryIds } } });
  await tx.categoryArchive.deleteMany({ where: { categoryId: { in: categoryIds } } });
  await tx.category.deleteMany({ where: { userId } });
  await tx.account.deleteMany({ where: { userId } });
  await tx.userSettings.deleteMany({ where: { userId } });
  await tx.aiAdviceCache.deleteMany({ where: { userId } });
  await tx.user.delete({ where: { id: userId } });
}

export async function deleteUserAccount(userId: string) {
  await prisma.$transaction((tx) => deleteUserDataInTx(tx, userId));
}
