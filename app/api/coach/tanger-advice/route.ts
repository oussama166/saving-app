import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { coachModel } from '@/lib/aiProvider';
import { getCachedAdvice, setCachedAdvice } from '@/lib/aiCache';
import { requireSession } from '@/lib/auth';

const CACHE_KEY = 'tanger-advice';

const adviceSchema = z.object({
  banques: z
    .string()
    .describe(
      "2-3 phrases courtes: recommandations de banques/comptes marocains adaptés au revenu et à l'épargne de l'utilisateur (CIH, Attijariwafa, Bank Of Africa...).",
    ),
  investissementMaroc: z
    .string()
    .describe(
      '2-3 phrases courtes: pistes concrètes pour investir au Maroc (Bourse de Casablanca, OPCVM, Bons du Trésor) adaptées au capital déjà investi.',
    ),
  investissementInternational: z
    .string()
    .describe(
      "2-3 phrases courtes: pistes pour diversifier à l'international (ETF mondiaux, dotation Office des Changes) adaptées à la capacité d'épargne actuelle.",
    ),
  erreursFatales: z
    .string()
    .describe('2-3 phrases courtes: mises en garde prioritaires et personnalisées selon la situation financière donnée.'),
});

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const { referenceIncome, emergencyFundBalance, portfolioValue, totalGoalsTarget, totalGoalsSaved } =
      await req.json();

    if (
      [referenceIncome, emergencyFundBalance, portfolioValue, totalGoalsTarget, totalGoalsSaved].some(
        (v) => typeof v !== 'number' || Number.isNaN(v),
      )
    ) {
      return NextResponse.json({ success: false, error: 'Données financières invalides' }, { status: 400 });
    }

    // 1. Cache hebdomadaire — évite un appel LLM à chaque chargement de page.
    const cached = await getCachedAdvice<{
      banques: string;
      investissementMaroc: string;
      investissementInternational: string;
      erreursFatales: string;
    }>(userId, CACHE_KEY);

    if (cached) {
      return NextResponse.json({
        success: true,
        advice: cached.content,
        cached: true,
        generatedAt: cached.generatedAt,
      });
    }

    // 2. Cache absent ou périmé (> 7 jours) — on régénère.
    const systemPrompt = `Tu es un conseiller financier basé à Tanger, Maroc. Style: ultra concis, chiffré quand pertinent, jamais générique. Bonne connaissance de l'écosystème bancaire et boursier marocain (CIH, Attijariwafa, Bank Of Africa, Bourse de Casablanca/MASI, OPCVM, Bons du Trésor) et des règles de l'Office des Changes pour l'investissement à l'international.`;

    const userPrompt = `Situation financière de l'utilisateur :
- Revenu de référence mensuel : ${Math.round(referenceIncome)} DH
- Fonds d'urgence actuel : ${Math.round(emergencyFundBalance)} DH
- Valeur du portefeuille (actions/ETF/crypto/OPCVM) : ${Math.round(portfolioValue)} DH
- Objectifs d'épargne : ${Math.round(totalGoalsSaved)} DH épargnés sur ${Math.round(totalGoalsTarget)} DH visés

Rédige 4 blocs de conseils courts et personnalisés à ces chiffres : Banques & Épargne, Investissement au Maroc, Investissement International, Erreurs Fatales à éviter.`;

    const { object } = await generateObject({
      model: coachModel,
      system: systemPrompt,
      prompt: userPrompt,
      schema: adviceSchema,
    });

    const generatedAt = await setCachedAdvice(userId, CACHE_KEY, object);

    return NextResponse.json({ success: true, advice: object, cached: false, generatedAt });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Tanger Advice Coach Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
