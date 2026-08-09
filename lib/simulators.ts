// Fonctions pures de calcul financier pour les 4 simulateurs de l'onglet
// Simulations du Coach IA (voir app/components/*Simulator.tsx) — aucun appel
// réseau, aucune IA : uniquement des formules d'intérêts composés/annuités
// standard, comme InterestSimulator.tsx déjà en place. Testables isolément,
// réutilisées par plusieurs composants.

/**
 * Mensualité nécessaire pour atteindre `targetAmount` dans `months` mois,
 * en partant de `currentAmount` déjà épargné, avec un rendement annuel
 * `annualRatePct` (0 = pas de rendement, juste de l'épargne pure).
 *
 * FV = PV*(1+r)^n + PMT * (((1+r)^n - 1) / r)  =>  PMT = (FV - PV*(1+r)^n) * r / ((1+r)^n - 1)
 * Retourne null si l'objectif est déjà atteint (PMT négatif ou nul).
 */
export function requiredMonthlyContribution(
  targetAmount: number,
  currentAmount: number,
  months: number,
  annualRatePct: number,
): number | null {
  if (months <= 0) return null;
  const monthlyRate = annualRatePct / 100 / 12;

  let pmt: number;
  if (monthlyRate === 0) {
    pmt = (targetAmount - currentAmount) / months;
  } else {
    const growthFactor = Math.pow(1 + monthlyRate, months);
    const futureValueOfCurrent = currentAmount * growthFactor;
    pmt = ((targetAmount - futureValueOfCurrent) * monthlyRate) / (growthFactor - 1);
  }

  return pmt > 0 ? pmt : null;
}

export interface DebtPayoffResult {
  months: number;
  totalInterest: number;
  totalPaid: number;
}

/**
 * Simule mois par mois le remboursement d'une dette à mensualité fixe
 * (approche itérative plutôt que la formule log fermée — plus robuste sur
 * les cas limites taux=0 ou mensualité proche du minimum, et plus lisible).
 * Retourne null si la mensualité ne couvre même pas les intérêts mensuels
 * (dette qui ne serait jamais remboursée).
 */
export function simulateDebtPayoff(
  balance: number,
  annualRatePct: number,
  monthlyPayment: number,
  maxMonths = 600,
): DebtPayoffResult | null {
  const monthlyRate = annualRatePct / 100 / 12;
  if (monthlyPayment <= balance * monthlyRate && monthlyRate > 0) return null;
  if (monthlyPayment <= 0) return null;

  let remaining = balance;
  let totalInterest = 0;
  let months = 0;

  while (remaining > 0 && months < maxMonths) {
    const interest = remaining * monthlyRate;
    const principal = Math.min(monthlyPayment - interest, remaining);
    remaining -= principal;
    totalInterest += interest;
    months += 1;
  }

  if (remaining > 0) return null; // pas remboursé dans la limite (maxMonths)

  return { months, totalInterest, totalPaid: balance + totalInterest };
}

export interface MultiDebtInput {
  id: string;
  name: string;
  balance: number;
  annualRatePct: number;
  minPayment: number;
}

export interface MultiDebtPayoffResult {
  months: number;
  totalInterest: number;
  // Ordre dans lequel chaque dette est intégralement soldée — utile pour
  // afficher "1. Carte Visa (mois 4) → 2. Prêt perso (mois 11)...".
  payoffOrder: { id: string; name: string; monthPaidOff: number }[];
}

/**
 * Simule le remboursement de PLUSIEURS dettes en parallèle selon une
 * stratégie d'ordre de priorité (boule de neige = solde le plus faible
 * d'abord, motivant psychologiquement ; avalanche = taux le plus élevé
 * d'abord, mathématiquement optimal). Chaque mois : le minimum est payé sur
 * TOUTES les dettes encore actives, et tout le budget restant
 * (`extraMonthlyBudget` + les minimums libérés par les dettes déjà soldées,
 * technique dite du "snowball rollover") est concentré sur la première dette
 * de la liste triée selon la stratégie.
 *
 * Retourne null si le budget total (somme des minimums + extra) ne couvre
 * même pas les intérêts cumulés du mois pour au moins une dette qui ne
 * reçoit que son minimum — la dette ne serait jamais soldée.
 */
export function simulateMultiDebtPayoff(
  debts: MultiDebtInput[],
  extraMonthlyBudget: number,
  strategy: 'snowball' | 'avalanche',
  maxMonths = 600,
): MultiDebtPayoffResult | null {
  if (debts.length === 0) return null;

  const order = [...debts].sort((a, b) =>
    strategy === 'snowball' ? a.balance - b.balance : b.annualRatePct - a.annualRatePct,
  );

  const remaining = new Map(order.map((d) => [d.id, d.balance]));
  const monthlyRates = new Map(order.map((d) => [d.id, d.annualRatePct / 100 / 12]));
  const payoffOrder: { id: string; name: string; monthPaidOff: number }[] = [];

  let totalInterest = 0;
  let months = 0;

  while ([...remaining.values()].some((b) => b > 0.01) && months < maxMonths) {
    months += 1;

    // Budget du mois = extra + minimums des dettes déjà soldées (rollover).
    let freeBudget = extraMonthlyBudget;
    for (const d of order) {
      if ((remaining.get(d.id) ?? 0) <= 0.01) freeBudget += d.minPayment;
    }

    // 1) Intérêts + minimum sur chaque dette encore active.
    for (const d of order) {
      const bal = remaining.get(d.id) ?? 0;
      if (bal <= 0.01) continue;
      const interest = bal * (monthlyRates.get(d.id) ?? 0);
      totalInterest += interest;
      const principal = Math.min(d.minPayment - interest, bal + interest);
      const newBal = bal + interest - Math.max(principal, 0);
      remaining.set(d.id, Math.max(newBal, 0));
    }

    // 2) Le budget libre est concentré sur la première dette active (ordre
    // stratégie), une seule à la fois — cœur de la méthode snowball/avalanche.
    for (const d of order) {
      if (freeBudget <= 0) break;
      const bal = remaining.get(d.id) ?? 0;
      if (bal <= 0.01) continue;
      const payment = Math.min(freeBudget, bal);
      remaining.set(d.id, bal - payment);
      freeBudget -= payment;
    }

    // Enregistre les dettes qui viennent d'être soldées ce mois-ci.
    for (const d of order) {
      if ((remaining.get(d.id) ?? 0) <= 0.01 && !payoffOrder.some((p) => p.id === d.id)) {
        payoffOrder.push({ id: d.id, name: d.name, monthPaidOff: months });
      }
    }
  }

  if ([...remaining.values()].some((b) => b > 0.01)) return null; // pas soldé dans maxMonths

  return { months, totalInterest, payoffOrder };
}

/**
 * Capital nécessaire pour générer `desiredMonthlyIncome` de revenu passif à
 * vie, selon la "règle des 4%" (taux de retrait annuel sécuritaire standard
 * en indépendance financière — ajustable via `withdrawalRatePct`).
 */
export function requiredCapitalForPassiveIncome(desiredMonthlyIncome: number, withdrawalRatePct = 4): number {
  if (withdrawalRatePct <= 0) return Infinity;
  return (desiredMonthlyIncome * 12) / (withdrawalRatePct / 100);
}

export interface CapitalProjectionResult {
  months: number; // null si pas atteint dans maxMonths
  finalCapital: number;
}

/**
 * Simule mois par mois combien de temps il faut pour atteindre
 * `targetCapital` en partant de `currentAmount`, avec une contribution
 * mensuelle fixe `monthlyContribution` et un rendement annuel `annualRatePct`.
 * Retourne null si jamais atteint dans `maxMonths` (ex: contribution nulle
 * et capital déjà en dessous de la cible).
 */
export function monthsToReachCapital(
  currentAmount: number,
  monthlyContribution: number,
  annualRatePct: number,
  targetCapital: number,
  maxMonths = 600,
): CapitalProjectionResult | null {
  if (currentAmount >= targetCapital) return { months: 0, finalCapital: currentAmount };
  const monthlyRate = annualRatePct / 100 / 12;

  let capital = currentAmount;
  let months = 0;
  while (capital < targetCapital && months < maxMonths) {
    capital = capital * (1 + monthlyRate) + monthlyContribution;
    months += 1;
  }

  if (capital < targetCapital) return null;
  return { months, finalCapital: capital };
}

/**
 * Mensualité d'un crédit classique (amortissement constant) — formule
 * d'annuité standard. `financedAmount` = prix - apport.
 */
export function loanMonthlyPayment(financedAmount: number, annualRatePct: number, months: number): number {
  if (months <= 0) return 0;
  const monthlyRate = annualRatePct / 100 / 12;
  if (monthlyRate === 0) return financedAmount / months;
  return (financedAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}
