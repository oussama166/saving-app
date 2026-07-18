import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWebhookAuth } from '@/lib/webhookAuth';
import { addManualContribution } from '@/lib/goalContributions';

// Accepte soit un token de webhook dédié (header `Authorization: Bearer
// <token>`, généré depuis la page Profil), soit le cookie de session
// classique (appel depuis l'app elle-même).
export async function POST(req: Request) {
  try {
    const { userId } = await requireWebhookAuth(req);
    const body = await req.json();

    // Le Shortcut iOS envoie parfois `amount` comme texte plutôt que comme
    // nombre (dictionnaire JSON avec un champ resté en type "Texte" côté
    // Shortcuts) — Prisma refuse une string pour un champ Float (increment
    // notamment), d'où un 500 générique. On force la conversion ici et on
    // rejette proprement avec un message clair plutôt que de planter.
    const amount = Number(body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: `Champ "amount" invalide : "${body?.amount}" n'est pas un nombre positif.` },
        { status: 400 },
      );
    }

    let account = await prisma.account.findFirst({
      where: { userId, name: 'Main Checking' },
    });

    if (!account) {
      account = await prisma.account.create({
        data: { userId, name: 'Main Checking', type: 'checking', balance: amount },
      });
    } else {
      await prisma.account.update({
        where: { id: account.id },
        data: { balance: { increment: amount } },
      });
    }

    const savingsGoals = await prisma.savingsGoal.findMany({
      where: { userId, autoAllocatePct: { gt: 0 } },
    });

    // Chaque allocation passe par addManualContribution : crée un
    // GoalContribution (historique, visible dans l'objectif) et, si
    // l'objectif a un compte/catégorie configurés, une vraie Transaction
    // (type savings) — plutôt que de faire bouger currentAmount en silence.
    for (const goal of savingsGoals) {
      const allocation = amount * (goal.autoAllocatePct / 100);
      if (allocation <= 0) continue;
      await addManualContribution({
        userId,
        goalId: goal.id,
        amount: allocation,
        note: `Allocation automatique (${goal.autoAllocatePct}% du salaire reçu)`,
        isAutomatic: true,
      });
    }

    return NextResponse.json({ success: true, allocated: savingsGoals.length });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Salary Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
