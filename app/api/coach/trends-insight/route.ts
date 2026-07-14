import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { coachModel } from '@/lib/aiProvider';
import { getCachedAdvice, setCachedAdvice } from '@/lib/aiCache';
import { requireSession } from '@/lib/auth';

const CACHE_KEY = 'trends-insight';

const insightSchema = z.object({
  synthese: z
    .string()
    .describe('1-2 phrases: tendance générale des dépenses et de l\'épargne sur la période observée.'),
  pointAttention: z
    .string()
    .describe('1 phrase: le point le plus préoccupant (catégorie qui dérape, mois en dérapage, baisse du taux d\'épargne...).'),
  recommandation: z
    .string()
    .describe('1 phrase: action concrète et chiffrée à prendre ce mois-ci pour corriger ou consolider la tendance.'),
});

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
    const { monthly, topCategories } = (await req.json()) as {
      monthly: MonthlyPoint[];
      topCategories: CategoryPoint[];
    };

    if (!Array.isArray(monthly) || monthly.length === 0) {
      return NextResponse.json({ success: false, error: 'Données mensuelles invalides' }, { status: 400 });
    }

    // 1. Cache hebdomadaire — évite un appel LLM à chaque chargement de page.
    const cached = await getCachedAdvice<{ synthese: string; pointAttention: string; recommandation: string }>(
      userId,
      CACHE_KEY,
    );

    if (cached) {
      return NextResponse.json({
        success: true,
        advice: cached.content,
        cached: true,
        generatedAt: cached.generatedAt,
      });
    }

    // 2. Cache absent ou périmé (> 7 jours) — on régénère.
    const systemPrompt = `Tu es un conseiller financier basé à Tanger, Maroc, spécialisé en analyse de tendances budgétaires. Style: ultra concis, chiffré, jamais générique.`;

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

    const { object } = await generateObject({
      model: coachModel,
      system: systemPrompt,
      prompt: userPrompt,
      schema: insightSchema,
    });

    const generatedAt = await setCachedAdvice(userId, CACHE_KEY, object);

    return NextResponse.json({ success: true, advice: object, cached: false, generatedAt });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Trends Insight Coach Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
