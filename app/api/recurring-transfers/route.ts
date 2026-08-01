import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getHouseholdContext } from '@/lib/household';

const MIN_DAY = 1;
const MAX_DAY = 28; // jamais 29-31 — voir prisma/schema.prisma (RecurringTransfer.dayOfMonth)

// Règles de virement automatique récurrent du foyer (voir
// lib/recurringTransfers.ts pour l'exécution). Rattachées au propriétaire
// budget comme les catégories/UserSettings — un seul jeu de règles partagé
// par le foyer plutôt qu'une par membre.
export async function GET() {
  try {
    const { userId } = await requireSession();
    const ctx = await getHouseholdContext(userId);

    const rules = await prisma.recurringTransfer.findMany({
      where: { userId: ctx.budgetOwnerId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, data: rules });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Recurring Transfers GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const { fromAccountId, toAccountId, amount, dayOfMonth } = (await req.json()) as {
      fromAccountId?: string;
      toAccountId?: string;
      amount?: number | string;
      dayOfMonth?: number | string;
    };

    if (!fromAccountId || !toAccountId) {
      return NextResponse.json({ success: false, error: 'Comptes source et destination requis' }, { status: 400 });
    }
    if (fromAccountId === toAccountId) {
      return NextResponse.json({ success: false, error: 'Choisis deux comptes différents' }, { status: 400 });
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Montant invalide' }, { status: 400 });
    }

    const numericDay = Number(dayOfMonth);
    if (!Number.isInteger(numericDay) || numericDay < MIN_DAY || numericDay > MAX_DAY) {
      return NextResponse.json(
        { success: false, error: `Jour du mois invalide (${MIN_DAY}-${MAX_DAY})` },
        { status: 400 },
      );
    }

    const ctx = await getHouseholdContext(userId);

    // Les deux comptes doivent appartenir au foyer — sans ce contrôle, un
    // client pourrait référencer le compte d'un autre utilisateur (tenant
    // croisé), qui serait ensuite débité/crédité chaque mois par le cron.
    const [fromAccount, toAccount] = await Promise.all([
      prisma.account.findFirst({ where: { id: fromAccountId, userId: { in: ctx.memberIds } } }),
      prisma.account.findFirst({ where: { id: toAccountId, userId: { in: ctx.memberIds } } }),
    ]);
    if (!fromAccount || !toAccount) {
      return NextResponse.json({ success: false, error: 'Compte introuvable' }, { status: 400 });
    }

    const rule = await prisma.recurringTransfer.create({
      data: {
        userId: ctx.budgetOwnerId,
        fromAccountId,
        toAccountId,
        amount: numericAmount,
        dayOfMonth: numericDay,
      },
    });

    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Recurring Transfers POST Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
