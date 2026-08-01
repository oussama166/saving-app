import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface TransactionFilters {
  search?: string;
  type?: 'income' | 'expense' | 'savings';
  categoryId?: string;
  // Filtre par compte (voir sélecteur ajouté à HistoryTable) — utile dès
  // qu'un foyer a plus d'un compte (courant/épargne/...) pour isoler les
  // mouvements de l'un d'eux.
  accountId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'date' | 'amount';
  sortDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface TransactionSummary {
  count: number;
  totalIncome: number;
  totalExpense: number;
  totalSavings: number;
  net: number;
}

const MAX_LIMIT = 500;

/**
 * Requête paginée/filtrée sur les transactions d'un utilisateur, partagée
 * entre GET /api/transactions (filtres dynamiques côté client) et le premier
 * rendu SSR de app/saisie/page.tsx, pour ne pas dupliquer la logique de
 * construction du `where` Prisma ni le calcul des totaux.
 *
 * `summary` porte sur TOUTES les lignes qui correspondent au filtre (pas
 * seulement la page courante) — calculé sur une requête séparée sans
 * take/skip, acceptable à l'échelle d'une app perso (des dizaines/centaines
 * de lignes, pas des millions).
 */
export async function getTransactionsPage(memberIds: string[], filters: TransactionFilters = {}) {
  const {
    search,
    type,
    categoryId,
    accountId,
    dateFrom,
    dateTo,
    sortBy = 'date',
    sortDir = 'desc',
    limit = 50,
    offset = 0,
  } = filters;

  const where: Prisma.TransactionWhereInput = {
    userId: { in: memberIds },
    ...(search ? { merchant: { contains: search } } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(accountId ? { accountId } : {}),
    ...(type ? { category: { type } } : {}),
    ...(dateFrom || dateTo
      ? {
          date: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999`) } : {}),
          },
        }
      : {}),
  };

  const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
  const safeOffset = Math.max(offset, 0);

  const [transactions, total, forSummary] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { category: true, account: true },
      orderBy: { [sortBy]: sortDir },
      take: safeLimit,
      skip: safeOffset,
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      select: { amount: true, category: { select: { type: true } } },
    }),
  ]);

  const summary: TransactionSummary = { count: forSummary.length, totalIncome: 0, totalExpense: 0, totalSavings: 0, net: 0 };
  for (const tx of forSummary) {
    // "transfer" (virement entre comptes du foyer) est neutre — ni revenu,
    // ni dépense, ni épargne, voir lib/transferEngine.ts. Sans ce filtre,
    // chaque virement gonflait totalExpense de son montant.
    if (tx.category.type === 'income') summary.totalIncome += tx.amount;
    else if (tx.category.type === 'savings') summary.totalSavings += Math.abs(tx.amount);
    else if (tx.category.type === 'expense') summary.totalExpense += Math.abs(tx.amount);
  }
  summary.net = summary.totalIncome - summary.totalExpense - summary.totalSavings;

  return { transactions, total, summary };
}
