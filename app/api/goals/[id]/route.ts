import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

const GOAL_TYPES = ['personnel', 'famille', 'urgence', 'projet'];

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;
    const body = await req.json();
    const {
      name,
      emoji,
      targetAmount,
      currentAmount,
      monthlyContribution,
      autoAllocatePct,
      goalType,
      beneficiary,
      note,
      targetDate,
      accountId,
      categoryId,
      autoContribute,
      contributionDay,
    } = body;

    const existing = await prisma.savingsGoal.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Objectif introuvable' }, { status: 404 });
    }

    if (goalType !== undefined && goalType !== null && !GOAL_TYPES.includes(goalType)) {
      return NextResponse.json({ success: false, error: "Type d'objectif invalide" }, { status: 400 });
    }

    // accountId reste toujours requis une fois l'objectif créé (pas d'option
    // pour le vider depuis l'UI) — seule une valeur non-null est acceptée ici.
    let resolvedAccountId: string | undefined;
    if (accountId) {
      const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
      if (!account) {
        return NextResponse.json({ success: false, error: 'Compte invalide' }, { status: 400 });
      }
      resolvedAccountId = account.id;
    }

    let resolvedCategoryId: string | null | undefined;
    if (categoryId !== undefined) {
      if (categoryId === null) {
        resolvedCategoryId = null;
      } else {
        const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
        if (!category) {
          return NextResponse.json({ success: false, error: 'Catégorie invalide' }, { status: 400 });
        }
        resolvedCategoryId = category.id;
      }
    }

    const nextAutoContribute = autoContribute !== undefined ? Boolean(autoContribute) : existing.autoContribute;
    const nextMonthlyContribution =
      monthlyContribution !== undefined ? Number(monthlyContribution) || 0 : existing.monthlyContribution;
    const nextAccountId = resolvedAccountId !== undefined ? resolvedAccountId : existing.accountId;
    const nextCategoryId = resolvedCategoryId !== undefined ? resolvedCategoryId : existing.categoryId;

    if (nextAutoContribute) {
      if (nextMonthlyContribution <= 0) {
        return NextResponse.json(
          { success: false, error: "Contribution mensuelle requise pour activer l'épargne automatique" },
          { status: 400 },
        );
      }
      if (!nextAccountId || !nextCategoryId) {
        return NextResponse.json(
          { success: false, error: "Compte et catégorie requis pour activer l'épargne automatique" },
          { status: 400 },
        );
      }
    }

    let resolvedContributionDay: number | undefined;
    if (contributionDay !== undefined) {
      const numeric = Number(contributionDay);
      if (!Number.isInteger(numeric) || numeric < 1 || numeric > 31) {
        return NextResponse.json({ success: false, error: 'Jour de versement invalide (1-31)' }, { status: 400 });
      }
      resolvedContributionDay = numeric;
    }

    const goal = await prisma.savingsGoal.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name) }),
        ...(emoji !== undefined && { emoji: emoji || null }),
        ...(targetAmount !== undefined && { targetAmount: Number(targetAmount) }),
        ...(currentAmount !== undefined && { currentAmount: Number(currentAmount) }),
        ...(monthlyContribution !== undefined && { monthlyContribution: nextMonthlyContribution }),
        ...(autoAllocatePct !== undefined && { autoAllocatePct: Number(autoAllocatePct) }),
        ...(goalType !== undefined && { goalType: goalType || 'personnel' }),
        ...(beneficiary !== undefined && { beneficiary: beneficiary || null }),
        ...(note !== undefined && { note: note || null }),
        ...(targetDate !== undefined && { targetDate: targetDate ? new Date(targetDate) : null }),
        ...(resolvedAccountId !== undefined && { accountId: resolvedAccountId }),
        ...(resolvedCategoryId !== undefined && { categoryId: resolvedCategoryId }),
        ...(autoContribute !== undefined && { autoContribute: nextAutoContribute }),
        ...(resolvedContributionDay !== undefined && { contributionDay: resolvedContributionDay }),
      },
    });

    return NextResponse.json({ success: true, data: goal });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Goals PUT Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;

    const existing = await prisma.savingsGoal.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Objectif introuvable' }, { status: 404 });
    }

    // Les versements historisés (GoalContribution) n'ont pas de sens sans
    // leur objectif — supprimés avec lui. Les Transactions réelles qu'ils
    // référencent restent intactes (juste plus liées à un GoalContribution).
    await prisma.$transaction(async (tx) => {
      await tx.goalContribution.deleteMany({ where: { goalId: id } });
      await tx.savingsGoal.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Goals DELETE Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
