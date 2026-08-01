export interface MonthBucket {
  key: string; // "2026-08"
  label: string; // "août 2026"
  start: Date;
  end: Date; // exclusif — [start, end)
}

/**
 * Construit les `monthsCount` derniers mois calendaires (dont le mois en
 * cours), du plus ancien au plus récent, avec leurs bornes de date. Extrait
 * de trois fonctions de lib/financials.ts (getMonthlyAnalytics,
 * getTopCategoriesTrend, getHealthSpendingTrend) qui reconstruisaient
 * chacune un tableau identique — un seul endroit à faire évoluer si la
 * logique change (ex: aligner sur le cycle budgétaire plutôt que le mois
 * calendaire).
 */
export function buildMonthBuckets(monthsCount: number, reference: Date = new Date()): MonthBucket[] {
  return Array.from({ length: monthsCount }, (_, i) => {
    const offset = monthsCount - 1 - i;
    const start = new Date(reference.getFullYear(), reference.getMonth() - offset, 1);
    const end = new Date(reference.getFullYear(), reference.getMonth() - offset + 1, 1);
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
    const label = start.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
    return { key, label, start, end };
  });
}
