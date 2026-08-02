import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
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

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;
    const ctx = await getHouseholdContext(userId);

    // Body optionnel : { deleteTransactions?: boolean } — coché explicitement
    // par l'utilisateur au moment de la suppression (voir app/abonnements) si
    // il veut aussi effacer les dépenses déjà enregistrées (typiquement le
    // prélèvement généré aujourd'hui par le rattrapage automatique, qu'il n'a
    // pas encore "accepté" comme réel). Défaut = false (comportement
    // historique, rien ne casse pour un appel sans body).
    let deleteTransactions = false;
    try {
      const body = await req.json();
      deleteTransactions = Boolean((body as { deleteTransactions?: boolean } | null)?.deleteTransactions);
    } catch {
      // pas de body JSON — comportement par défaut (détacher seulement)
    }

    const existing = await prisma.subscription.findFirst({ where: { id, userId: { in: ctx.memberIds } } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Abonnement introuvable' }, { status: 404 });
    }

    // Forme batch $transaction([...]) (pas la forme interactive
    // `async (tx) => {...}`) : plus fiable contre l'adapter libSQL/Turso à
    // distance, même choix que lib/subscriptions.ts.
    const ops: Prisma.PrismaPromise<unknown>[] = [];

    if (deleteTransactions) {
      // Supprime réellement les dépenses liées à cet abonnement et rétablit
      // le solde des comptes concernés (contrairement au détachement par
      // défaut, qui garde l'historique intact) — demandé explicitement via
      // la case à cocher, un choix par suppression plutôt qu'un comportement
      // automatique silencieux.
      const linkedTransactions = await prisma.transaction.findMany({
        where: { subscriptionId: id, userId: { in: ctx.memberIds } },
        select: { id: true, accountId: true, amount: true },
      });

      const balanceDeltaByAccount = new Map<string, number>();
      for (const t of linkedTransactions) {
        // amount est négatif pour une dépense (a déjà décrémenté le solde à
        // la création) — le retirer doit donc AJOUTER l'équivalent au solde.
        balanceDeltaByAccount.set(t.accountId, (balanceDeltaByAccount.get(t.accountId) ?? 0) - t.amount);
      }
      for (const [accountId, delta] of balanceDeltaByAccount) {
        ops.push(prisma.account.update({ where: { id: accountId }, data: { balance: { increment: delta } } }));
      }
      ops.push(
        prisma.transaction.deleteMany({
          where: { id: { in: linkedTransactions.map((t) => t.id) } },
        }),
      );
    } else {
      // Comportement historique : on détache les transactions déjà générées
      // plutôt que de les supprimer — l'historique de dépenses passées reste
      // intact même après suppression de la définition de l'abonnement.
      ops.push(
        prisma.transaction.updateMany({
          where: { subscriptionId: id, userId: { in: ctx.memberIds } },
          data: { subscriptionId: null },
        }),
      );
    }

    // SubscriptionPlanChange n'a de sens que rattaché à un abonnement
    // existant (pas de champ nullable), donc son historique de changements
    // de plan part avec l'abonnement dans tous les cas.
    ops.push(prisma.subscriptionPlanChange.deleteMany({ where: { subscriptionId: id } }));
    ops.push(prisma.subscription.delete({ where: { id } }));

    await prisma.$transaction(ops);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Subscriptions DELETE Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
