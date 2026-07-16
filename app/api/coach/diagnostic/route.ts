import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { coachModel } from '@/lib/aiProvider';
import { getCachedAdvice, setCachedAdvice } from '@/lib/aiCache';
import { requireSession } from '@/lib/auth';
import { getUserLocale } from '@/lib/getLocale';
import { aiLanguageInstruction } from '@/lib/i18n';

const CACHE_KEY = 'diagnostic-coach';

const diagnosticSchema = z.object({
  profilLabel: z.string().describe('2 à 4 mots : nom du profil dépensier du mois (ex: "Épargnant Discipliné").'),
  profilDesc: z.string().describe('1 phrase courte expliquant ce profil, avec les chiffres clés (%).'),
  pointFort: z
    .string()
    .describe('1 phrase : la catégorie ou le comportement le mieux maîtrisé ce mois-ci, chiffré. Si rien ne se démarque, le dire.'),
  pointFaible: z
    .string()
    .describe('1 phrase : la catégorie ou le comportement le plus problématique ce mois-ci, chiffré. Si rien ne pose problème, le dire.'),
  recommandation: z
    .string()
    .describe('1 à 2 phrases : action concrète et chiffrée à prendre ce mois-ci, adaptée à la situation.'),
});

interface BudgetDetail {
  categoryName: string;
  budgetedAmount: number;
  spentAmount: number;
  usedPct: number;
}

interface Rule503020 {
  needs: { amount: number; pct: number };
  wants: { amount: number; pct: number };
  savings: { amount: number; pct: number };
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const locale = await getUserLocale(userId);
    const { budgetDetails, rule503020, emergencyFundMonths, healthScore } = (await req.json()) as {
      budgetDetails: BudgetDetail[];
      rule503020: Rule503020;
      emergencyFundMonths: number;
      healthScore: number;
    };

    if (!Array.isArray(budgetDetails) || !rule503020) {
      return NextResponse.json({ success: false, error: 'Données de diagnostic invalides' }, { status: 400 });
    }

    // 1. Cache hebdomadaire — évite un appel LLM à chaque chargement de page.
    const cached = await getCachedAdvice<{
      profilLabel: string;
      profilDesc: string;
      pointFort: string;
      pointFaible: string;
      recommandation: string;
    }>(userId, `${CACHE_KEY}:${locale}`);

    if (cached) {
      return NextResponse.json({
        success: true,
        advice: cached.content,
        cached: true,
        generatedAt: cached.generatedAt,
      });
    }

    // 2. Cache absent ou périmé (> 7 jours) — on régénère.
    const systemPrompt = `Tu es un coach financier basé à Tanger, Maroc. Style: direct, chiffré, jamais générique. Tu analyses le mois en cours de l'utilisateur pour lui donner un diagnostic honnête. ${aiLanguageInstruction(locale)}`;

    const budgetLines = budgetDetails
      .filter((b) => b.budgetedAmount > 0)
      .map((b) => `- ${b.categoryName}: ${Math.round(b.spentAmount)} DH dépensés / ${Math.round(b.budgetedAmount)} DH prévus (${b.usedPct}% utilisé)`)
      .join('\n');

    const userPrompt = `Situation du mois en cours :
- Répartition 50/30/20 réelle : Besoins ${rule503020.needs.pct}%, Envies ${rule503020.wants.pct}%, Épargne ${rule503020.savings.pct}%
- Fonds d'urgence : ${emergencyFundMonths.toFixed(1)} mois de dépenses couverts
- Score de santé financière : ${healthScore}%

Détail par catégorie budgétaire :
${budgetLines || 'Aucune dépense catégorisée ce mois-ci.'}

Donne un profil dépensier, un point fort, un point faible et une recommandation, chacun chiffré et adapté précisément à ces données.`;

    const { object } = await generateObject({
      model: coachModel,
      system: systemPrompt,
      prompt: userPrompt,
      schema: diagnosticSchema,
    });

    const generatedAt = await setCachedAdvice(userId, `${CACHE_KEY}:${locale}`, object);

    return NextResponse.json({ success: true, advice: object, cached: false, generatedAt });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Diagnostic Coach Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
