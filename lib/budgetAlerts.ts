import { prisma } from "@/lib/prisma";
import { sendBudgetAlertEmail } from "@/lib/email";
import { formatYearMonth } from "@/lib/subscriptions";
import { getHouseholdContext } from "@/lib/household";
import { resolveBudgetCycleStart } from "@/lib/budgetCycle";

// Paliers vérifiés du plus haut au plus bas : si une seule transaction fait
// passer une catégorie de 50% à 120% d'un coup, on notifie uniquement le
// palier "dépassement" (100%), pas les deux — évite un double email pour le
// même événement. Un mois donné ne génère donc jamais plus d'un email par
// catégorie et par palier (voir BudgetAlertSent, contrainte unique sur
// categoryId+yearMonth+threshold).
const THRESHOLDS = [100, 80] as const;

/**
 * À appeler après la création d'une transaction dépense (saisie manuelle,
 * webhook Apple Pay, prélèvement d'abonnement). Recalcule le % utilisé du
 * budget mensuel de la catégorie et envoie un email d'alerte si un palier
 * (80% ou 100%) vient d'être franchi et n'a pas déjà été notifié ce mois-ci.
 *
 * Ne lève jamais d'exception : une alerte manquée ne doit jamais faire
 * échouer la transaction financière elle-même.
 */
export async function checkAndSendBudgetAlert(
  userId: string,
  categoryId: string,
  txDate: Date = new Date(),
): Promise<void> {
  try {
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || category.type !== "expense" || category.budgetPct <= 0) return;

    // Budget partagé : le foyer entier (voir lib/household.ts) — le seuil
    // se calcule sur les dépenses de TOUS les membres sur cette catégorie
    // partagée, et l'email part vers chaque membre plutôt qu'un seul (sinon
    // le partenaire ne saurait jamais que le budget commun dérape).
    const ctx = await getHouseholdContext(userId);

    const [userSettings, members] = await Promise.all([
      prisma.userSettings.findUnique({ where: { userId: ctx.budgetOwnerId } }),
      prisma.user.findMany({ where: { id: { in: ctx.memberIds } }, select: { email: true } }),
    ]);
    if (members.length === 0) return;

    const referenceIncome = userSettings?.referenceIncome ?? 10000;
    const budget = (category.budgetPct / 100) * referenceIncome;
    if (budget <= 0) return;

    // Début du cycle budgétaire (jour de paie configuré, pas forcément le
    // 1er calendaire — voir lib/budgetCycle.ts) évalué à la date de LA
    // transaction qui vient de se produire, pas "maintenant" : un import CSV
    // rétroactif doit rattacher la dépense au bon cycle, celui où elle a
    // réellement eu lieu.
    const cycleStart = await resolveBudgetCycleStart(ctx, txDate, userSettings);
    const monthExpenses = await prisma.transaction.findMany({
      where: { userId: { in: ctx.memberIds }, categoryId, date: { gte: cycleStart }, amount: { lt: 0 } },
      select: { amount: true },
    });
    const spent = monthExpenses.reduce((acc, t) => acc + Math.abs(t.amount), 0);
    const usedPct = (spent / budget) * 100;

    const yearMonth = formatYearMonth(txDate.getFullYear(), txDate.getMonth() + 1);

    for (const threshold of THRESHOLDS) {
      if (usedPct < threshold) continue;

      const alreadySent = await prisma.budgetAlertSent.findUnique({
        where: { categoryId_yearMonth_threshold: { categoryId, yearMonth, threshold } },
      });
      if (alreadySent) return; // déjà notifié à ce palier ce mois-ci

      // create() d'abord : si l'email échoue ensuite (Resend down, quota...),
      // on ne retente pas indéfiniment à chaque transaction suivante — le
      // "presque tout le monde reçoit une alerte" est préférable à un email
      // renvoyé en boucle en cas de souci temporaire côté Resend.
      await prisma.budgetAlertSent.create({ data: { userId: ctx.budgetOwnerId, categoryId, yearMonth, threshold } });
      await Promise.all(
        members.map((m) =>
          sendBudgetAlertEmail(m.email, {
            categoryName: category.name,
            threshold,
            spent,
            budget,
            usedPct,
          }),
        ),
      );
      return;
    }
  } catch (error) {
    console.error("checkAndSendBudgetAlert a échoué:", error);
  }
}
