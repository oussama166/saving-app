import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getHouseholdMemberIds } from '@/lib/household';
import { formatYearMonth } from '@/lib/subscriptions';

// Bascule manuellement le statut d'une facture pour le mois courant —
// complète la détection automatique par transaction liée (voir
// lib/billCalendar.ts) pour les factures sans catégorie associée, ou quand
// le rapprochement automatique échoue.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const paid = body?.paid !== false; // défaut : marquer payé (paid=false pour annuler)

    const memberIds = await getHouseholdMemberIds(userId);
    const existing = await prisma.bill.findFirst({ where: { id, userId: { in: memberIds } } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Facture introuvable' }, { status: 404 });
    }

    const now = new Date();
    const currentYM = formatYearMonth(now.getFullYear(), now.getMonth() + 1);

    const bill = await prisma.bill.update({
      where: { id },
      data: { manuallyPaidYearMonth: paid ? currentYM : null },
    });

    return NextResponse.json({ success: true, data: bill });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Bills Mark-Paid Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
