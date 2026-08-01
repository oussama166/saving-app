import { NextResponse } from 'next/server';
import { streamCoachAdvice } from '@/lib/coachHandler';
import { trendsInsightSchema as insightSchema } from '@/lib/coachSchemas';
import { requireSession } from '@/lib/auth';
import { getUserLocale } from '@/lib/getLocale';
import { aiLanguageInstruction } from '@/lib/i18n';

const CACHE_KEY = 'trends-insight';

interface MonthlyPoint {
  label: string;
  income: number;
  expenses: number;
  savings: number;
  savingsRatePct: number;
}

interface CategoryPoint {
  name: string;
  total: number;
  trendPct: number | null;
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const locale = await getUserLocale(userId);
    const { monthly, topCategories, force } = (await req.json()) as {
      monthly: MonthlyPoint[];
      topCategories: CategoryPoint[];
      force?: boolean;
    };

    if (!Array.isArray(monthly) || monthly.length === 0) {
      return NextResponse.json({ success: false, error: 'Données mensuelles invalides' }, { status: 400 });
    }

    const systemPrompt = `Tu es un conseiller financier basé à Tanger, Maroc, spécialisé en analyse de tendances budgétaires. Style: ultra concis, chiffré, jamais générique. ${aiLanguageInstruction(locale)}`;

    const monthlyLines = monthly
      .map(
        (m) =>
          `- ${m.label}: revenu ${Math.round(m.income)} DH, dépenses ${Math.round(m.expenses)} DH, épargne/invest ${Math.round(m.savings)} DH (${m.savingsRatePct}% du revenu)`,
      )
      .join('\n');

    const categoryLines = topCategories
      .map(
        (c) =>
          `- ${c.name}: ${c.total} DH cumulés, évolution ${c.trendPct === null ? 'nouvelle dépense' : `${c.trendPct > 0 ? '+' : ''}${c.trendPct}%`} entre le premier et le dernier mois observé`,
      )
      .join('\n');

    const userPrompt = `Historique mensuel (du plus ancien au plus récent) :
${monthlyLines}

Top catégories de dépense sur la période :
${categoryLines}

Donne une synthèse de la tendance générale, le point d'attention le plus important, et une recommandation concrète pour ce mois-ci, chacun en UNE phrase courte.`;

    return await streamCoachAdvice({
      userId,
      locale,
      baseCacheKey: CACHE_KEY,
      input: { monthly, topCategories },
      schema: insightSchema,
      system: systemPrompt,
      prompt: userPrompt,
      force,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Trends Insight Coach Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
