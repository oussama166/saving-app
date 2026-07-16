import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { coachModel } from '@/lib/aiProvider';
import { getCachedAdvice, setCachedAdvice } from '@/lib/aiCache';
import { requireSession } from '@/lib/auth';
import { getUserLocale } from '@/lib/getLocale';
import { aiLanguageInstruction } from '@/lib/i18n';

const CACHE_KEY = 'emergency-fund';

const adviceSchema = z.object({
  objectif: z
    .string()
    .describe('Une phrase courte et directe: diagnostic de la situation actuelle (manque, correct, ou excédentaire).'),
  methode: z
    .string()
    .describe('Une phrase courte et concrète: action chiffrée à prendre ce mois-ci (virement, réallocation...).'),
  recommandations: z
    .array(z.string())
    .min(2)
    .max(3)
    .describe('2 à 3 placements ou banques marocaines courts (5-10 mots chacun), adaptés au montant en jeu.'),
});

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const locale = await getUserLocale(userId);
    const {
      emergencyFundBalance,
      emergencyFundTarget,
      emergencyFundTargetMonths,
      monthsCovered,
      avgMonthlyExpenses,
    } = await req.json();

    if (
      [emergencyFundBalance, emergencyFundTarget, emergencyFundTargetMonths, monthsCovered, avgMonthlyExpenses].some(
        (v) => typeof v !== 'number' || Number.isNaN(v),
      )
    ) {
      return NextResponse.json({ success: false, error: 'Données financières invalides' }, { status: 400 });
    }

    // 1. Cache hebdomadaire — évite un appel Gemini à chaque chargement de page.
    const cached = await getCachedAdvice<{ objectif: string; methode: string; recommandations: string[] }>(
      userId,
      `${CACHE_KEY}:${locale}`,
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
    const gapAmount = emergencyFundTarget - emergencyFundBalance;

    const systemPrompt = `Tu es un conseiller financier basé à Tanger, Maroc, spécialisé en fonds d'urgence. Style: ultra concis, chiffré, jamais générique. Connaissance de l'écosystème bancaire marocain (CIH, Attijariwafa, Bank Of Africa, Bons du Trésor). ${aiLanguageInstruction(locale)}`;

    const userPrompt = `Situation du Fonds d'Urgence :
- Solde actuel : ${Math.round(emergencyFundBalance)} DH
- Objectif : ${Math.round(emergencyFundTarget)} DH (${emergencyFundTargetMonths} mois de dépenses)
- Dépenses mensuelles moyennes : ${Math.round(avgMonthlyExpenses)} DH
- Couverture actuelle : ${monthsCovered.toFixed(1)} mois
- Écart vs objectif : ${Math.round(gapAmount)} DH ${gapAmount <= 0 ? '(objectif déjà atteint ou dépassé)' : '(manquant)'}

Donne un diagnostic + une méthode + des recommandations, chacun en UNE phrase courte, adaptés précisément à ces chiffres.`;

    const { object } = await generateObject({
      model: coachModel,
      system: systemPrompt,
      prompt: userPrompt,
      schema: adviceSchema,
    });

    const generatedAt = await setCachedAdvice(userId, `${CACHE_KEY}:${locale}`, object);

    return NextResponse.json({ success: true, advice: object, cached: false, generatedAt });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Emergency Fund Coach Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
