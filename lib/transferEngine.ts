import { prisma } from '@/lib/prisma';
import { getRatesToMad } from '@/lib/exchangeRates';

// Moteur de virement partagé entre le virement manuel (voir
// app/api/transfer/route.ts, déclenché depuis TransferCard) et les virements
// automatiques récurrents (voir lib/recurringTransfers.ts, déclenché par le
// cron app/api/cron/recurring-transfers/route.ts) — même logique de
// débit/crédit + création des deux lignes de transaction liées dans les deux
// cas, pour ne jamais désynchroniser les deux chemins.
//
// `memberIds` : les comptes source/destination doivent tous les deux
// appartenir à ce foyer — c'est à l'appelant de résoudre le bon foyer (celui
// de l'utilisateur connecté pour un virement manuel, celui du propriétaire de
// la règle pour un virement récurrent) avant d'appeler cette fonction.
// `budgetOwnerId` : propriétaire canonique des Category du foyer (voir
// lib/household.ts) — la catégorie "Transfer" est cherchée/créée sous cet ID,
// jamais sous celui du compte débité, pour rester unique et partagée par tout
// le foyer au lieu d'être dupliquée par membre.
export async function executeTransfer(
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  memberIds: string[],
  budgetOwnerId: string,
) {
  // Résolution des devises + taux de change AVANT la transaction DB —
  // getRatesToMad() peut faire un appel réseau externe (API de taux), qu'il
  // ne faut jamais faire à l'intérieur d'une transaction Prisma interactive
  // (tient un verrou/une connexion ouverte le temps de l'appel réseau, même
  // souci de principe que le chunking CSV import à cause de Turso/libSQL).
  // `amount` est toujours exprimé dans la devise du compte SOURCE (comme
  // saisi dans TransferCard) ; s'il diffère de la devise du compte
  // destination, on convertit via MAD pour créditer le bon montant réel —
  // sans ça, un virement USD -> MAD (ou inversement) déplaçait le mauvais
  // montant de valeur sur la jambe destination.
  const [fromAccountPreview, toAccountPreview] = await Promise.all([
    prisma.account.findFirst({ where: { id: fromAccountId, userId: { in: memberIds } } }),
    prisma.account.findFirst({ where: { id: toAccountId, userId: { in: memberIds } } }),
  ]);
  if (!fromAccountPreview) {
    throw new Error('Source account not found');
  }
  if (!toAccountPreview) {
    throw new Error('Destination account not found');
  }

  const sameCurrency = fromAccountPreview.currency === toAccountPreview.currency;
  const fxRates = sameCurrency ? null : await getRatesToMad([fromAccountPreview.currency, toAccountPreview.currency]);
  const amountInDestCurrency = sameCurrency
    ? amount
    : (amount * (fxRates![fromAccountPreview.currency] ?? 1)) / (fxRates![toAccountPreview.currency] ?? 1);

  return prisma.$transaction(async (tx) => {
    const fromAccount = await tx.account.findFirst({
      where: { id: fromAccountId, userId: { in: memberIds } },
    });

    if (!fromAccount) {
      throw new Error('Source account not found');
    }

    if (fromAccount.balance < amount) {
      throw new Error('Insufficient funds');
    }

    const toAccount = await tx.account.findFirst({
      where: { id: toAccountId, userId: { in: memberIds } },
    });

    if (!toAccount) {
      throw new Error('Destination account not found');
    }

    await tx.account.update({
      where: { id: fromAccountId },
      data: { balance: { decrement: amount } },
    });

    await tx.account.update({
      where: { id: toAccountId },
      data: { balance: { increment: amountInDestCurrency } },
    });

    let category = await tx.category.findFirst({
      where: { userId: budgetOwnerId, name: 'Transfer' },
    });

    if (!category) {
      category = await tx.category.create({
        data: { userId: budgetOwnerId, name: 'Transfer', type: 'transfer' },
      });
    }

    const transaction = await tx.transaction.create({
      data: {
        // Attribuée au propriétaire réel du compte débité, pas forcément la
        // personne (ou le job automatique) qui déclenche le virement — voir
        // lib/household.ts.
        userId: fromAccount.userId,
        accountId: fromAccountId,
        categoryId: category.id,
        merchant: `Transfer to ${toAccount.name}`,
        amount: -amount,
        date: new Date(),
      },
    });

    await tx.transaction.create({
      data: {
        userId: toAccount.userId,
        accountId: toAccountId,
        categoryId: category.id,
        merchant: `Transfer from ${fromAccount.name}`,
        // Dans la devise du compte destination (voir résolution en haut de
        // fonction) — identique à `amount` si les deux comptes partagent la
        // même devise, ce qui reste le cas pour l'immense majorité des foyers.
        amount: amountInDestCurrency,
        date: new Date(),
      },
    });

    return transaction;
  });
}
