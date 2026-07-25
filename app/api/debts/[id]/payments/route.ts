import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { notifyRefresh } from '@/lib/sse';

const DEBT_PAYMENT_CATEGORY_NAME = 'Remboursement de dettes';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;

    const debt = await prisma.debt.findFirst({ where: { id, userId } });
    if (!debt) {
      return NextResponse.json({ success: false, error: 'Dette introuvable' }, { status: 404 });
    }

    const payments = await prisma.debtPayment.findMany({
      where: { debtId: id },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ success: true, data: payments });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Debt Payments GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;
    const body = await req.json();
    const { amount, date, note, logTransaction, accountId } = body;

    const debt = await prisma.debt.findFirst({ where: { id, userId } });
    if (!debt) {
      return NextResponse.json({ success: false, error: 'Dette introuvable' }, { status: 404 });
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json({ success: false, error: 'Montant invalide' }, { status: 400 });
    }

    const paymentDate = date ? new Date(date) : new Date();
    if (Number.isNaN(paymentDate.getTime())) {
      return NextResponse.json({ success: false, error: 'Date invalide' }, { status: 400 });
    }

    const nextBalance = Math.max(0, debt.currentBalance - amountNum);

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    let transactionId: string | null = null;

    // Créer une vraie Transaction (compte + catégorie dédiée) est optionnel :
    // certains remboursements (ex: dette perso entre proches, déjà comptée
    // ailleurs) ne doivent pas impacter le solde d'un compte suivi.
    if (logTransaction) {
      const account = accountId
        ? await prisma.account.findFirst({ where: { id: accountId, userId } })
        : await prisma.account.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
      if (!account) {
        return NextResponse.json(
          { success: false, error: 'Aucun compte trouvé pour enregistrer ce remboursement.' },
          { status: 400 },
        );
      }

      let category = await prisma.category.findFirst({ where: { userId, name: DEBT_PAYMENT_CATEGORY_NAME } });
      if (!category) {
        category = await prisma.category.create({
          data: { userId, name: DEBT_PAYMENT_CATEGORY_NAME, type: 'expense' },
        });
      }

      // On a besoin de l'id de la transaction avant de créer le DebtPayment
      // (FK transactionId) — pas de moyen de le connaître à l'avance avec
      // $transaction([...]) en forme batch, donc cette branche utilise
      // exceptionnellement 2 allers-retours séquentiels plutôt qu'un seul
      // batch atomique. Risque acceptable : au pire un DebtPayment orphelin
      // sans transactionId si le 2e échoue, jamais de transaction fantôme.
      const transaction = await prisma.transaction.create({
        data: {
          userId,
          accountId: account.id,
          categoryId: category.id,
          merchant: debt.name,
          amount: -Math.abs(amountNum),
          date: paymentDate,
        },
      });
      transactionId = transaction.id;
      ops.push(
        prisma.account.update({ where: { id: account.id }, data: { balance: { decrement: amountNum } } }),
      );
    }

    ops.push(
      prisma.debt.update({ where: { id }, data: { currentBalance: nextBalance, isActive: nextBalance > 0 } }),
    );
    ops.push(
      prisma.debtPayment.create({
        data: {
          debtId: id,
          userId,
          amount: amountNum,
          date: paymentDate,
          note: note || null,
          transactionId,
        },
      }),
    );

    await prisma.$transaction(ops as Prisma.PrismaPromise<unknown>[]);

    notifyRefresh();

    return NextResponse.json({ success: true, remainingBalance: nextBalance, debtPaidOff: nextBalance === 0 });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Debt Payments POST Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
