import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { catchUpGoalContributions } from '@/lib/goalContributions';

export const dynamic = 'force-dynamic';

const GOAL_TYPES = ['personnel', 'famille', 'urgence', 'projet'];

export async function GET() {
  try {
    const { userId } = await requireSession();

    // Rattrapage des versements automatiques manqués avant de renvoyer la
    // liste — voir lib/goalContributions.ts (pas de cron serveur).
    await catchUpGoalContributions(userId);

    const [goals, accounts, categories] = await Promise.all([
      prisma.savingsGoal.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.category.findMany({ where: { userId, type: { not: 'income' } }, orderBy: { order: 'asc' } }),
    ]);

    return NextResponse.json({
      success: true,
      data: goals,
      accounts: accounts.map((a) => ({ id: a.id, name: a.name })),
      categories: categories.map((c) => ({ id: c.id, name: c.name, type: c.type })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Goals GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
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

    if (!name || !targetAmount) {
      return NextResponse.json({ success: false, error: 'Nom et montant cible requis' }, { status: 400 });
    }

    if (goalType !== undefined && !GOAL_TYPES.includes(goalType)) {
      return NextResponse.json({ success: false, error: 'Type d\'objectif invalide' }, { status: 400 });
    }

    let resolvedAccountId: string | null = null;
    if (accountId) {
      const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
      if (!account) {
        return NextResponse.json({ success: false, error: 'Compte invalide' }, { status: 400 });
      }
      resolvedAccountId = account.id;
    } else {
      const firstAccount = await prisma.account.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
      resolvedAccountId = firstAccount?.id ?? null;
    }

    let resolvedCategoryId: string | null = null;
    if (categoryId) {
      const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
      if (!category) {
        return NextResponse.json({ success: false, error: 'Catégorie invalide' }, { status: 400 });
      }
      resolvedCategoryId = category.id;
    }

    const wantsAutoContribute = Boolean(autoContribute);
    const numericMonthlyContribution = Number(monthlyContribution) || 0;
    if (wantsAutoContribute) {
      if (numericMonthlyContribution <= 0) {
        return NextResponse.json(
          { success: false, error: "Contribution mensuelle requise pour activer l'épargne automatique" },
          { status: 400 },
        );
      }
      if (!resolvedAccountId || !resolvedCategoryId) {
        return NextResponse.json(
          { success: false, error: "Compte et catégorie requis pour activer l'épargne automatique" },
          { status: 400 },
        );
      }
    }

    let numericContributionDay = Number(contributionDay) || 1;
    if (!Number.isInteger(numericContributionDay) || numericContributionDay < 1 || numericContributionDay > 31) {
      numericContributionDay = 1;
    }

    const goal = await prisma.savingsGoal.create({
      data: {
        userId,
        name: String(name),
        emoji: emoji || null,
        targetAmount: Number(targetAmount),
        currentAmount: Number(currentAmount) || 0,
        monthlyContribution: numericMonthlyContribution,
        autoAllocatePct: Number(autoAllocatePct) || 0,
        goalType: goalType || 'personnel',
        beneficiary: beneficiary || null,
        note: note || null,
        targetDate: targetDate ? new Date(targetDate) : null,
        accountId: resolvedAccountId,
        categoryId: resolvedCategoryId,
        autoContribute: wantsAutoContribute,
        contributionDay: numericContributionDay,
      },
    });

    // Rattrape immédiatement si le jour de prélèvement de ce mois est déjà
    // passé (comme pour les abonnements).
    if (wantsAutoContribute) {
      await catchUpGoalContributions(userId);
    }

    return NextResponse.json({ success: true, data: goal });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Goals POST Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
