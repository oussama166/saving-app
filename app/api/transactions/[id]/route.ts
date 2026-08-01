import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyRefresh } from '@/lib/sse';
import { requireSession } from '@/lib/auth';
import { getHouseholdContext } from '@/lib/household';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;
    const { date, categoryId, subCategory, paymentMethod, notes, amount, accountId } = (await req.json()) as {
      date?: string;
      categoryId?: string;
      subCategory?: string;
      paymentMethod?: string;
      notes?: string;
      amount?: number | string;
      // Compte cible (optionnel) — permet de corriger le compte d'une saisie
      // faite par erreur sur le mauvais compte, pas seulement son montant.
      accountId?: string;
    };

    const ctx = await getHouseholdContext(userId);

    // Corrigé pour utiliser le foyer (memberIds), pas seulement l'auteur
    // d'origine — sinon un membre du foyer ne peut pas corriger une saisie
    // faite par son partenaire (ex: import CSV), incohérent avec le reste de
    // l'app (voir lib/household.ts).
    const transaction = await prisma.transaction.findFirst({ where: { id, userId: { in: ctx.memberIds } } });
    if (!transaction) {
      return NextResponse.json({ success: false, error: 'Transaction introuvable' }, { status: 404 });
    }

    if (!date || !categoryId || amount === undefined || amount === null || amount === '') {
      return NextResponse.json({ success: false, error: 'Date, catégorie et montant requis' }, { status: 400 });
    }

    // Même contrôle anti-croisement de tenant que POST /api/transactions.
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId: ctx.budgetOwnerId } });
    if (!category) {
      return NextResponse.json({ success: false, error: 'Catégorie invalide' }, { status: 400 });
    }

    // Le signe du montant suit TOUJOURS le type de la catégorie choisie
    // (jamais un champ "type" séparé envoyé par le client) — évite tout
    // désaccord entre le badge affiché (basé sur category.type) et le signe
    // réellement stocké, qui s'était déjà produit par le passé (voir
    // commentaire dans TransactionForm.tsx sur la cohérence Type/Enveloppe).
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount === 0) {
      return NextResponse.json({ success: false, error: 'Montant invalide' }, { status: 400 });
    }
    const adjustedAmount = category.type === 'expense' ? -Math.abs(numericAmount) : Math.abs(numericAmount);

    // Compte cible : celui demandé (vérifié contre le foyer) ou celui déjà
    // en place si non fourni/non changé.
    let targetAccountId = transaction.accountId;
    if (accountId && accountId !== transaction.accountId) {
      const targetAccount = await prisma.account.findFirst({ where: { id: accountId, userId: { in: ctx.memberIds } } });
      if (!targetAccount) {
        return NextResponse.json({ success: false, error: 'Compte invalide' }, { status: 400 });
      }
      targetAccountId = targetAccount.id;
    }

    const result = await prisma.$transaction(async (tx) => {
      // Annule l'impact de l'ancien montant sur l'ANCIEN compte, puis
      // applique le nouveau montant sur le NOUVEAU compte (identique à
      // l'ancien si le compte n'a pas changé — les deux updates s'appliquent
      // simplement l'un après l'autre sur la même ligne, net correct).
      await tx.account.update({
        where: { id: transaction.accountId },
        data: { balance: { decrement: transaction.amount } },
      });
      await tx.account.update({
        where: { id: targetAccountId },
        data: { balance: { increment: adjustedAmount } },
      });

      return tx.transaction.update({
        where: { id },
        data: {
          date: new Date(date),
          categoryId,
          subCategory: subCategory || null,
          paymentMethod: paymentMethod || null,
          merchant: notes || transaction.merchant,
          amount: adjustedAmount,
          accountId: targetAccountId,
        },
        include: { category: true, account: true },
      });
    });

    notifyRefresh();

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Transaction PATCH Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;
    const ctx = await getHouseholdContext(userId);

    // Même correctif que PATCH ci-dessus : scope foyer, pas seulement
    // l'auteur d'origine.
    const transaction = await prisma.transaction.findFirst({ where: { id, userId: { in: ctx.memberIds } } });
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
