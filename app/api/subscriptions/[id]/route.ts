import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getHouseholdContext } from '@/lib/household';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;
    const body = await req.json();
    const { name, categoryId, accountId, subCategory, price, billingDay, isActive } = body as {
      name?: string;
      categoryId?: string;
      accountId?: string;
      subCategory?: string | null;
      price?: number;
      billingDay?: number;
      isActive?: boolean;
    };

    const ctx = await getHouseholdContext(userId);
    const existing = await prisma.subscription.findFirst({ where: { id, userId: { in: ctx.memberIds } } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Abonnement introuvable' }, { status: 404 });
    }

    const data: {
      name?: string;
      categoryId?: string;
      accountId?: string;
      subCategory?: string | null;
      price?: number;
      billingDay?: number;
      isActive?: boolean;
    } = {};

    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json({ success: false, error: "Nom de l'abonnement requis" }, { status: 400 });
      }
      data.name = name.trim();
    }

    if (categoryId !== undefined) {
      const category = await prisma.category.findFirst({ where: { id: categoryId, userId: ctx.budgetOwnerId } });
      if (!category) {
        return NextResponse.json({ success: false, error: 'Catégorie invalide' }, { status: 400 });
      }
      data.categoryId = categoryId;
    }

    if (accountId !== undefined) {
      const account = await prisma.account.findFirst({ where: { id: accountId, userId: { in: ctx.memberIds } } });
      if (!account) {
        return NextResponse.json({ success: false, error: 'Compte invalide' }, { status: 400 });
      }
      data.accountId = accountId;
    }

    if (subCategory !== undefined) data.subCategory = subCategory || null;

    if (price !== undefined) {
      const numericPrice = Number(price);
      if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        return NextResponse.json({ success: false, error: 'Prix invalide' }, { status: 400 });
      }
      data.price = numericPrice;
    }

    if (billingDay !== undefined) {
      const numericBillingDay = Number(billingDay);
      if (!Number.isInteger(numericBillingDay) || numericBillingDay < 1 || numericBillingDay > 31) {
        return NextResponse.json({ success: false, error: 'Jour de prélèvement invalide (1-31)' }, { status: 400 });
      }
      data.billingDay = numericBillingDay;
    }

    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const updated = await prisma.subscription.update({ where: { id }, data });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Subscriptions PATCH Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;
    const ctx = await getHouseholdContext(userId);

    const existing = await prisma.subscription.findFirst({ where: { id, userId: { in: ctx.memberIds } } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Abonnement introuvable' }, { status: 404 });
    }

    // On détache les transactions déjà générées plutôt que de les supprimer
    // — l'historique de dépenses passées reste intact même après suppression
    // de la définition de l'abonnement. SubscriptionPlanChange, lui, n'a de
    // sens que rattaché à un abonnement existant (pas de champ nullable),
    // donc son historique de changements de plan part avec l'abonnement.
    await prisma.$transaction(async (tx) => {
      await tx.transaction.updateMany({
        where: { subscriptionId: id, userId: { in: ctx.memberIds } },
        data: { subscriptionId: null },
      });
      await tx.subscriptionPlanChange.deleteMany({ where: { subscriptionId: id } });
      await tx.subscription.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Subscriptions DELETE Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
