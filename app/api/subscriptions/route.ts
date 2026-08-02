import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { catchUpSubscriptionCharges, getNextBillingDate, getUpcomingSubscriptionReminders } from '@/lib/subscriptions';
import { getHouseholdContext } from '@/lib/household';
import { requireFeatureAccess } from '@/lib/features';

export async function GET() {
  try {
    const { userId } = await requireSession();
    await requireFeatureAccess('subscriptions', userId);

    // Rattrapage des prélèvements manqués avant de renvoyer la liste — voir
    // lib/subscriptions.ts (pas de cron serveur, contrainte hébergement gratuit).
    await catchUpSubscriptionCharges(userId);
    const ctx = await getHouseholdContext(userId);

    const [subscriptions, accounts, categories, upcomingReminders] = await Promise.all([
      prisma.subscription.findMany({
        where: { userId: { in: ctx.memberIds } },
        include: { category: true, account: true, _count: { select: { planChanges: true, transactions: true } } },
        orderBy: { billingDay: 'asc' },
      }),
      prisma.account.findMany({ where: { userId: { in: ctx.memberIds } }, orderBy: { createdAt: 'asc' } }),
      prisma.category.findMany({ where: { userId: ctx.budgetOwnerId, type: 'expense' }, orderBy: { order: 'asc' } }),
      // Abonnements dont le prochain prélèvement tombe dans 2-5 jours (voir
      // lib/subscriptions.ts) — affichés en bannière pour laisser le temps de
      // suspendre/annuler avant d'être débité (même fenêtre que le rappel
      // email envoyé par le cron /api/cron/subscription-reminders).
      getUpcomingSubscriptionReminders(userId),
    ]);

    const data = subscriptions.map((sub) => ({
      id: sub.id,
      name: sub.name,
      provider: sub.provider,
      subCategory: sub.subCategory,
      price: sub.price,
      billingDay: sub.billingDay,
      isActive: sub.isActive,
      categoryId: sub.categoryId,
      categoryName: sub.category.name,
      accountId: sub.accountId,
      accountName: sub.account.name,
      nextBillingDate: sub.isActive ? getNextBillingDate(sub).toISOString() : null,
      planChangeCount: sub._count.planChanges,
      transactionCount: sub._count.transactions,
    }));

    const totalMonthly = subscriptions.filter((s) => s.isActive).reduce((acc, s) => acc + s.price, 0);

    return NextResponse.json({
      success: true,
      data: {
        subscriptions: data,
        totalMonthly,
        accounts: accounts.map((a) => ({ id: a.id, name: a.name })),
        categories: categories.map((c) => ({ id: c.id, name: c.name })),
        upcomingReminders: upcomingReminders.map((r) => ({
          ...r,
          nextBillingDate: r.nextBillingDate.toISOString(),
        })),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'FEATURE_DISABLED') {
      return NextResponse.json({ success: false, error: 'Cette fonctionnalité est temporairement désactivée.' }, { status: 403 });
    }
    console.error('Subscriptions GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const body = await req.json();
    const { name, provider, categoryId, accountId, subCategory, price, billingDay, isActive } = body as {
      name?: string;
      provider?: string | null;
      categoryId?: string;
      accountId?: string;
      subCategory?: string | null;
      price?: number;
      billingDay?: number;
      isActive?: boolean;
    };

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Nom de l'abonnement requis" }, { status: 400 });
    }
    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return NextResponse.json({ success: false, error: 'Prix invalide' }, { status: 400 });
    }
    const numericBillingDay = Number(billingDay);
    if (!Number.isInteger(numericBillingDay) || numericBillingDay < 1 || numericBillingDay > 31) {
      return NextResponse.json({ success: false, error: 'Jour de prélèvement invalide (1-31)' }, { status: 400 });
    }
    if (!categoryId) {
      return NextResponse.json({ success: false, error: 'Catégorie requise' }, { status: 400 });
    }

    const ctx = await getHouseholdContext(userId);

    const category = await prisma.category.findFirst({ where: { id: categoryId, userId: ctx.budgetOwnerId } });
    if (!category) {
      return NextResponse.json({ success: false, error: 'Catégorie invalide' }, { status: 400 });
    }

    let account = accountId
      ? await prisma.account.findFirst({ where: { id: accountId, userId: { in: ctx.memberIds } } })
      : null;
    if (!account) {
      account = await prisma.account.findFirst({ where: { userId: { in: ctx.memberIds } }, orderBy: { createdAt: 'asc' } });
    }
    if (!account) {
      return NextResponse.json({ success: false, error: 'Aucun compte disponible' }, { status: 400 });
    }

    const subscription = await prisma.subscription.create({
      data: {
        userId,
        accountId: account.id,
        categoryId,
        name: name.trim(),
        provider: provider || null,
        subCategory: subCategory || null,
        price: numericPrice,
        billingDay: numericBillingDay,
        isActive: isActive === undefined ? true : Boolean(isActive),
      },
    });

    // Rattrape immédiatement si le jour de prélèvement de ce mois est déjà
    // passé (ex: on ajoute Netflix le 20 avec billingDay=15 -> charge le mois
    // courant tout de suite plutôt que d'attendre le mois prochain).
    await catchUpSubscriptionCharges(userId);

    return NextResponse.json({ success: true, data: subscription });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Subscriptions POST Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
