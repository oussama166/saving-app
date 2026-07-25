import { prisma } from "@/lib/prisma";
import { getEnrichedPortfolioAssets } from "@/lib/portfolio";

// Seuils (nisab) traditionnels, en grammes — l'or (85g) est le plus utilisé
// dans les calculateurs de zakat grand public, l'argent (595g) donne un
// seuil plus bas (donc un devoir de zakat plus inclusif), retenu par
// certains savants comme plus prudent aujourd'hui vu l'écart de valeur
// actuel entre or et argent. On laisse le choix à l'utilisateur plutôt que
// de trancher à sa place.
export const NISAB_GOLD_GRAMS = 85;
export const NISAB_SILVER_GRAMS = 595;
export const ZAKAT_RATE = 0.025; // 2.5%, taux standard de la zakat sur la richesse (zakat al-mal)

export interface ZakatWealthBreakdown {
  cashAndBankBalances: number;
  portfolioValue: number;
  totalDebts: number;
  zakatableWealth: number;
}

/**
 * Calcule la richesse "zakatable" simplifiée : liquidités (tous les comptes)
 * + valeur actuelle du portfolio, moins les dettes actives (voir
 * lib/deleteUserData.ts / prisma/schema.prisma pour Debt). Les objectifs
 * d'épargne (SavingsGoal.currentAmount) ne sont PAS rajoutés séparément : cet
 * argent a déjà transité par de vraies Transactions dans un compte, donc il
 * est déjà compté dans cashAndBankBalances — l'additionner à nouveau
 * compterait deux fois la même somme.
 *
 * Simplification assumée (pas un avis religieux) : compte l'intégralité du
 * portfolio et des liquidités, sans distinguer biens personnels/de
 * consommation (non zakatables) des actifs commerciaux/d'investissement. À
 * ajuster manuellement selon sa propre situation/école de pensée.
 */
export async function computeZakatableWealth(userId: string): Promise<ZakatWealthBreakdown> {
  const [accounts, portfolio, activeDebts] = await Promise.all([
    prisma.account.findMany({ where: { userId } }),
    getEnrichedPortfolioAssets(userId),
    prisma.debt.findMany({ where: { userId, isActive: true } }),
  ]);

  const cashAndBankBalances = accounts.reduce((acc, a) => acc + a.balance, 0);
  const portfolioValue = portfolio.globalLiveValue;
  const totalDebts = activeDebts.reduce((acc, d) => acc + d.currentBalance, 0);

  const zakatableWealth = Math.max(0, cashAndBankBalances + portfolioValue - totalDebts);

  return { cashAndBankBalances, portfolioValue, totalDebts, zakatableWealth };
}
