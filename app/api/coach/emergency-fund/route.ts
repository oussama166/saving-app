import { NextResponse } from 'next/server';
import { streamCoachAdvice } from '@/lib/coachHandler';
import { emergencyFundSchema as adviceSchema } from '@/lib/coachSchemas';
import { requireSession } from '@/lib/auth';
import { getUserLocale } from '@/lib/getLocale';
import { aiLanguageInstruction } from '@/lib/i18n';

const CACHE_KEY = 'emergency-fund';

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
      force,
    } = await req.json();

    if (
      [emergencyFundBalance, emergencyFundTarget, emergencyFundTargetMonths, monthsCovered, avgMonthlyExpenses].some(
        (v) => typeof v !== 'number' || Number.isNaN(v),
      )
    ) {
      return NextResponse.json({ success: false, error: 'Données financières invalides' }, { status: 400 });
    }

    const gapAmount = emergencyFundTarget - emergencyFundBalance;

    const systemPrompt = `Tu es un conseiller financier basé à Tanger, Maroc, spécialisé en fonds d'urgence. Style: ultra concis, chiffré, jamais générique. Connaissance de l'écosystème bancaire marocain (CIH, Attijariwafa, Bank Of Africa, Bons du Trésor). ${aiLanguageInstruction(locale)}`;

    const userPrompt = `Situation du Fonds d'Urgence :
- Solde actuel : ${Math.round(emergencyFundBalance)} DH
- Objectif : ${Math.round(emergencyFundTarget)} DH (${emergencyFundTargetMonths} mois de dépenses)
- Dépenses mensuelles moyennes : ${Math.round(avgMonthlyExpenses)} DH
- Couverture actuelle : ${monthsCovered.toFixed(1)} mois
- Écart vs objectif : ${Math.round(gapAmount)} DH ${gapAmount <= 0 ? '(objectif déjà atteint ou dépassé)' : '(manquant)'}

Donne un diagnostic + une méthode + des recommandations, chacun en UNE phrase courte, adaptés précisément à ces chiffres.`;

    return await streamCoachAdvice({
      userId,
      locale,
      baseCacheKey: CACHE_KEY,
      input: { emergencyFundBalance, emergencyFundTarget, emergencyFundTargetMonths, monthsCovered, avgMonthlyExpenses },
      schema: adviceSchema,
      system: systemPrompt,
      prompt: userPrompt,
      force,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Emergency Fund Coach Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
