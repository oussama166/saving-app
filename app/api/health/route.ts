import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyRefresh } from '@/lib/sse';
import { requireSession } from '@/lib/auth';
import { getHouseholdContext } from '@/lib/household';

export async function GET() {
  try {
    const { userId } = await requireSession();
    const ctx = await getHouseholdContext(userId);
    const records = await prisma.medicalRecord.findMany({
      where: { userId: { in: ctx.memberIds } },
      orderBy: { date: 'desc' },
      include: {
        transaction: { select: { id: true, merchant: true, amount: true } },
      },
    });
    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Health GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const { provider, amount, date, reimbursementStatus, linkTransaction, subCategory, paymentMethod } =
      await req.json();

    if (!provider || amount === undefined || !date) {
      return NextResponse.json({ success: false, error: 'Champs requis manquants' }, { status: 400 });
    }

    const absAmount = Math.abs(Number(amount));
    const ctx = await getHouseholdContext(userId);

    // Lien optionnel avec une Transaction "Santé & Médical" : crédite la même
    // écriture que Saisie & Histo (compte "Main Checking", montant négatif),
    // pour que le soin apparaisse aussi dans l'historique et les totaux.
    if (linkTransaction) {
      const category = await prisma.category.findFirst({ where: { userId: ctx.budgetOwnerId, name: 'Santé & Médical' } });
      if (!category) {
        return NextResponse.json(
          { success: false, error: 'Catégorie "Santé & Médical" introuvable' },
          { status: 400 },
        );
      }

      let account = await prisma.account.findFirst({ where: { userId: { in: ctx.memberIds }, name: 'Main Checking' } });
      if (!account) {
        account = await prisma.account.create({
          data: { userId, name: 'Main Checking', type: 'checking', balance: 0 },
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const transaction = await tx.transaction.create({
          data: {
            userId,
            accountId: account!.id,
            categoryId: category.id,
            subCategory: subCategory || null,
            paymentMethod: paymentMethod || null,
            merchant: provider,
            amount: -absAmount,
            date: new Date(date),
          },
        });

        await tx.account.update({
          where: { id: account!.id },
          data: { balance: { decrement: absAmount } },
        });

        const record = await tx.medicalRecord.create({
          data: {
            userId,
            transactionId: transaction.id,
            provider,
            amount: absAmount,
            reimbursementStatus: reimbursementStatus || 'PENDING',
            date: new Date(date),
          },
        });

        return record;
      });

      notifyRefresh();

      return NextResponse.json({ success: true, data: result });
    }

    // Sans transaction liée : simple entrée de suivi médical (ex: soin déjà
    // payé/enregistré ailleurs, ou remboursement en cours sans nouvelle dépense).
    const record = await prisma.medicalRecord.create({
      data: {
        userId,
        provider,
        amount: absAmount,
        reimbursementStatus: reimbursementStatus || 'PENDING',
        date: new Date(date),
      },
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Health POST Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
