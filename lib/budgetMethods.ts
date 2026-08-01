// Registre des méthodologies de budgétisation proposées à l'utilisateur (page
// Profil, sélection via UserSettings.budgetMethod) — voir aussi
// app/api/dashboard/route.ts (carte BudgetMethodCard) et
// app/profil/page.tsx (BudgetMethodSelector).
//
// Trois familles ("kind") :
// - "ratio"      : répartit le revenu en buckets cibles en % (50/30/20,
//                  70/20/10, se payer en premier, règle des 60%) — calculé à
//                  la volée depuis les totaux du cycle courant, rien de
//                  nouveau à stocker.
// - "allocation" : réutilise le système EXISTANT de budgetPct par catégorie
//                  (ProfileAllocationEditor / DetailedBudgetTable, qui impose
//                  déjà une somme à 100%) — "Base zéro", "Enveloppes" et
//                  "Personnalisé" ne sont que 3 façons différentes de
//                  présenter ce même moteur, pas 3 systèmes distincts.
// - "journal"    : Kakeibo, seule méthode qui a besoin d'un vrai nouveau
//                  modèle (KakeiboEntry, réflexion mensuelle en 4 questions).

export type BudgetMethodKind = 'ratio' | 'allocation' | 'journal';

export interface MethodTotals {
  income: number;
  essential: number;
  discretionary: number;
  savings: number;
}

export interface BudgetMethodBucketDef {
  key: string;
  labelKey: string;
  targetPct: number;
  pick: (t: MethodTotals) => number;
  // Précision informative affichée sous la barre (ex: sous-répartition
  // indicative des 40% "flexibles" de la règle des 60%) — non calculée
  // indépendamment, juste un repère textuel.
  subNoteKey?: string;
}

export interface BudgetMethodDef {
  key: string;
  kind: BudgetMethodKind;
  labelKey: string;
  descriptionKey: string;
  buckets?: BudgetMethodBucketDef[];
}

const pickEssential = (t: MethodTotals) => t.essential;
const pickDiscretionary = (t: MethodTotals) => t.discretionary;
const pickSavings = (t: MethodTotals) => t.savings;
const pickFreeOfSavings = (t: MethodTotals) => t.essential + t.discretionary;
const pickFlexible = (t: MethodTotals) => t.discretionary + t.savings;

export const BUDGET_METHODS: Record<string, BudgetMethodDef> = {
  '503020': {
    key: '503020',
    kind: 'ratio',
    labelKey: 'budgetMethod.503020.label',
    descriptionKey: 'budgetMethod.503020.description',
    buckets: [
      { key: 'essential', labelKey: 'budgetMethod.bucket.needs', targetPct: 50, pick: pickEssential },
      { key: 'discretionary', labelKey: 'budgetMethod.bucket.wants', targetPct: 30, pick: pickDiscretionary },
      { key: 'savings', labelKey: 'budgetMethod.bucket.savings', targetPct: 20, pick: pickSavings },
    ],
  },
  '702010': {
    key: '702010',
    kind: 'ratio',
    labelKey: 'budgetMethod.702010.label',
    descriptionKey: 'budgetMethod.702010.description',
    buckets: [
      { key: 'essential', labelKey: 'budgetMethod.bucket.needs', targetPct: 70, pick: pickEssential },
      { key: 'discretionary', labelKey: 'budgetMethod.bucket.wants', targetPct: 20, pick: pickDiscretionary },
      { key: 'savings', labelKey: 'budgetMethod.bucket.savings', targetPct: 10, pick: pickSavings },
    ],
  },
  payYourselfFirst: {
    key: 'payYourselfFirst',
    kind: 'ratio',
    labelKey: 'budgetMethod.payYourselfFirst.label',
    descriptionKey: 'budgetMethod.payYourselfFirst.description',
    buckets: [
      { key: 'savings', labelKey: 'budgetMethod.bucket.savings', targetPct: 20, pick: pickSavings },
      { key: 'free', labelKey: 'budgetMethod.bucket.free', targetPct: 80, pick: pickFreeOfSavings },
    ],
  },
  '60solution': {
    key: '60solution',
    kind: 'ratio',
    labelKey: 'budgetMethod.60solution.label',
    descriptionKey: 'budgetMethod.60solution.description',
    buckets: [
      { key: 'committed', labelKey: 'budgetMethod.bucket.committed', targetPct: 60, pick: pickEssential },
      {
        key: 'flexible',
        labelKey: 'budgetMethod.bucket.flexible',
        targetPct: 40,
        pick: pickFlexible,
        subNoteKey: 'budgetMethod.60solution.subNote',
      },
    ],
  },
  zeroBased: {
    key: 'zeroBased',
    kind: 'allocation',
    labelKey: 'budgetMethod.zeroBased.label',
    descriptionKey: 'budgetMethod.zeroBased.description',
  },
  envelope: {
    key: 'envelope',
    kind: 'allocation',
    labelKey: 'budgetMethod.envelope.label',
    descriptionKey: 'budgetMethod.envelope.description',
  },
  custom: {
    key: 'custom',
    kind: 'allocation',
    labelKey: 'budgetMethod.custom.label',
    descriptionKey: 'budgetMethod.custom.description',
  },
  kakeibo: {
    key: 'kakeibo',
    kind: 'journal',
    labelKey: 'budgetMethod.kakeibo.label',
    descriptionKey: 'budgetMethod.kakeibo.description',
  },
};

export const BUDGET_METHOD_ORDER = ['503020', '702010', 'payYourselfFirst', '60solution', 'zeroBased', 'envelope', 'custom', 'kakeibo'];

export interface BudgetMethodBucketResult {
  key: string;
  labelKey: string;
  targetPct: number;
  targetAmount: number;
  actualAmount: number;
  actualPct: number;
  subNoteKey?: string;
}

export interface BudgetMethodResult {
  key: string;
  kind: BudgetMethodKind;
  totalBasis: number;
  buckets: BudgetMethodBucketResult[];
}

/**
 * Calcule les buckets cible/réel d'une méthode "ratio" à partir des totaux du
 * cycle courant. Retourne null pour les méthodes "allocation"/"journal" (pas
 * de buckets en %, voir DetailedBudgetTable / KakeiboCard à la place).
 */
export function computeBudgetMethodResult(methodKey: string, totals: MethodTotals): BudgetMethodResult | null {
  const def = BUDGET_METHODS[methodKey] ?? BUDGET_METHODS['503020'];
  if (def.kind !== 'ratio' || !def.buckets) return null;

  const basis = totals.income > 0 ? totals.income : totals.essential + totals.discretionary + totals.savings;
  const safeBasis = basis > 0 ? basis : 1;

  const buckets: BudgetMethodBucketResult[] = def.buckets.map((b) => {
    const actualAmount = b.pick(totals);
    return {
      key: b.key,
      labelKey: b.labelKey,
      targetPct: b.targetPct,
      targetAmount: Math.round((b.targetPct / 100) * safeBasis),
      actualAmount: Math.round(actualAmount),
      actualPct: Math.round((actualAmount / safeBasis) * 1000) / 10,
      subNoteKey: b.subNoteKey,
    };
  });

  return { key: def.key, kind: def.kind, totalBasis: Math.round(basis), buckets };
}

export function getBudgetMethodDef(methodKey: string): BudgetMethodDef {
  return BUDGET_METHODS[methodKey] ?? BUDGET_METHODS['503020'];
}
