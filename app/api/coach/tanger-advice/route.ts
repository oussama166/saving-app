import { NextResponse } from 'next/server';
import { streamCoachAdvice } from '@/lib/coachHandler';
import { tangerAdviceSchema as adviceSchema } from '@/lib/coachSchemas';
import { requireSession } from '@/lib/auth';
import { getUserLocale } from '@/lib/getLocale';
import { aiLanguageInstruction } from '@/lib/i18n';

const CACHE_KEY = 'tanger-advice';

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const locale = await getUserLocale(userId);
    const { referenceIncome, emergencyFundBalance, portfolioValue, totalGoalsTarget, totalGoalsSaved, force } =
      await req.json();

    if (
      [referenceIncome, emergencyFundBalance, portfolioValue, totalGoalsTarget, totalGoalsSaved].some(
        (v) => typeof v !== 'number' || Number.isNaN(v),
      )
    ) {
      return NextResponse.json({ success: false, error: 'Données financières invalides' }, { status: 400 });
    }

    const systemPrompt = `Tu es un conseiller financier basé à Tanger, Maroc. Style: ultra concis, chiffré quand pertinent, jamais générique. Bonne connaissance de l'écosystème bancaire et boursier marocain (CIH, Attijariwafa, Bank Of Africa, Bourse de Casablanca/MASI, OPCVM, Bons du Trésor) et des règles de l'Office des Changes pour l'investissement à l'international. ${aiLanguageInstruction(locale)}`;

    const userPrompt = `Situation financière de l'utilisateur :
- Revenu de référence mensuel : ${Math.round(referenceIncome)} DH
- Fonds d'urgence actuel : ${Math.round(emergencyFundBalance)} DH
- Valeur du portefeuille (actions/ETF/crypto/OPCVM) : ${Math.round(portfolioValue)} DH
- Objectifs d'épargne : ${Math.round(totalGoalsSaved)} DH épargnés sur ${Math.round(totalGoalsTarget)} DH visés

Rédige 4 blocs de conseils courts et personnalisés à ces chiffres : Banques & Épargne, Investissement au Maroc, Investissement International, Erreurs Fatales à éviter.`;

    return await streamCoachAdvice({
      userId,
      locale,
      baseCacheKey: CACHE_KEY,
      input: { referenceIncome, emergencyFundBalance, portfolioValue, totalGoalsTarget, totalGoalsSaved },
      schema: adviceSchema,
      system: systemPrompt,
      prompt: userPrompt,
      force,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Tanger Advice Coach Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
