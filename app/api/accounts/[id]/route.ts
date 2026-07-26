import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getHouseholdMemberIds } from '@/lib/household';

// Renommer un compte — la devise n'est PAS modifiable une fois le compte
// créé (des transactions existantes seraient alors dans une devise qui ne
// correspond plus au compte, faussant tous les calculs) : si besoin de
// changer de devise, créer un nouveau compte et transférer.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;
    const { name } = (await req.json()) as { name?: string };

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Nom du compte requis' }, { status: 400 });
    }

    const memberIds = await getHouseholdMemberIds(userId);
    const existing = await prisma.account.findFirst({ where: { id, userId: { in: memberIds } } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Compte introuvable' }, { status: 404 });
    }

    const account = await prisma.account.update({ where: { id }, data: { name: name.trim() } });
    return NextResponse.json({ success: true, data: account });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Account PATCH Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;

    const memberIds = await getHouseholdMemberIds(userId);
    const existing = await prisma.account.findFirst({ where: { id, userId: { in: memberIds } } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Compte introuvable' }, { status: 404 });
    }

    // Suppression bloquée si le compte est encore référencé ailleurs — on ne
    // veut pas de Transaction/SavingsGoal/Subscription/PortfolioAsset orphelins.
    const [txCount, goalCount, subCount, assetCount] = await Promise.all([
      prisma.transaction.count({ where: { accountId: id } }),
      prisma.savingsGoal.count({ where: { accountId: id } }),
      prisma.subscription.count({ where: { accountId: id } }),
      prisma.portfolioAsset.count({ where: { accountId: id } }),
    ]);
    if (txCount + goalCount + subCount + assetCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Ce compte est encore utilisé (transactions, objectifs, abonnements ou actifs) — impossible de le supprimer.',
        },
        { status: 400 },
      );
    }

    await prisma.account.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Account DELETE Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
