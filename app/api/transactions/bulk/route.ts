import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notifyRefresh } from '@/lib/sse';
import { requireSession } from '@/lib/auth';
import { getHouseholdMemberIds } from '@/lib/household';
import { buildTransactionWhere } from '@/lib/transactions';

// Suppression groupée de l'historique (voir app/components/HistoryTable.tsx)
// — utile pour nettoyer d'un coup des dizaines de transactions de test (ex:
// abonnements ajoutés plusieurs fois pendant un test du webhook, puis
// supprimés côté abonnement mais dont les dépenses restaient orphelines dans
// l'historique) sans les supprimer une par une.
//
// Deux modes, selon ce que le client envoie :
// - Body JSON `{ ids: string[] }` : sélection manuelle via les cases à
//   cocher du tableau — vérifiée contre le foyer (memberIds) pour éviter
//   qu'un id d'un autre utilisateur ne soit supprimé.
// - Sinon, query params identiques à GET /api/transactions (search/type/
//   categoryId/accountId/dateFrom/dateTo) : "tout ce qui correspond au
//   filtre actif" — réutilise EXACTEMENT buildTransactionWhere (partagé avec
//   GET /api/transactions) pour ne jamais supprimer autre chose que ce que
//   l'utilisateur voit affiché à l'écran au moment du clic. Au moins un
//   filtre est requis dans ce mode, pour ne jamais permettre de vider tout
//   l'historique par erreur.
export async function DELETE(req: Request) {
  try {
    const { userId } = await requireSession();
    const { searchParams } = new URL(req.url);
    const memberIds = await getHouseholdMemberIds(userId);

    // Body optionnel — un DELETE avec body n'est pas standard partout mais
    // supporté par fetch()/Next.js ; on l'essaie en best-effort avant de
    // retomber sur les query params.
    let explicitIds: string[] | null = null;
    try {
      const body = await req.json();
      if (Array.isArray(body?.ids) && body.ids.every((v: unknown) => typeof v === 'string')) {
        explicitIds = body.ids;
      }
    } catch {
      // pas de body JSON — mode filtre par query params
    }

    let where: Prisma.TransactionWhereInput;
    if (explicitIds) {
      if (explicitIds.length === 0) {
        return NextResponse.json({ success: true, deletedCount: 0 });
      }
      where = { id: { in: explicitIds }, userId: { in: memberIds } };
    } else {
      const typeParam = searchParams.get('type');
      const type = typeParam === 'income' || typeParam === 'expense' || typeParam === 'savings' ? typeParam : undefined;
      const search = searchParams.get('search') || undefined;
      const categoryId = searchParams.get('categoryId') || undefined;
      const accountId = searchParams.get('accountId') || undefined;
      const dateFrom = searchParams.get('dateFrom') || undefined;
      const dateTo = searchParams.get('dateTo') || undefined;

      if (!search && !type && !categoryId && !accountId && !dateFrom && !dateTo) {
        return NextResponse.json(
          { success: false, error: 'Au moins un filtre (ou une sélection) est requis pour une suppression groupée.' },
          { status: 400 },
        );
      }

      where = buildTransactionWhere(memberIds, { search, type, categoryId, accountId, dateFrom, dateTo });
    }

    const matching = await prisma.transaction.findMany({
      where,
      select: { id: true, accountId: true, amount: true },
    });

    if (matching.length === 0) {
      return NextResponse.json({ success: true, deletedCount: 0 });
    }

    // Un seul update par compte impacté (somme des montants), plutôt qu'un
    // update par transaction — même principe que la suppression groupée des
    // transactions d'un abonnement (voir app/api/subscriptions/[id]/route.ts).
    const balanceDeltaByAccount = new Map<string, number>();
    for (const t of matching) {
      balanceDeltaByAccount.set(t.accountId, (balanceDeltaByAccount.get(t.accountId) ?? 0) - t.amount);
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const [accId, delta] of balanceDeltaByAccount) {
      ops.push(prisma.account.update({ where: { id: accId }, data: { balance: { increment: delta } } }));
    }
    ops.push(prisma.transaction.deleteMany({ where: { id: { in: matching.map((t) => t.id) } } }));

    await prisma.$transaction(ops);

    notifyRefresh();

    return NextResponse.json({ success: true, deletedCount: matching.length });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Transactions Bulk Delete Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
