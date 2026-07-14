import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyRefresh } from '@/lib/sse';
import { requireSession } from '@/lib/auth';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;

    const transaction = await prisma.transaction.findFirst({ where: { id, userId } });
    if (!transaction) {
      return NextResponse.json({ success: false, error: 'Transaction introuvable' }, { status: 404 });
    }

    await prisma.$transaction([
      // Décrémente le solde du compte de l'impact exact qu'avait eu cette
      // transaction à la création (symétrique de POST /api/transactions).
      prisma.account.update({
        where: { id: transaction.accountId },
        data: { balance: { decrement: transaction.amount } },
      }),
      prisma.transaction.delete({ where: { id } }),
    ]);

    notifyRefresh();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Transaction Delete Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
