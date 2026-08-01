import { NextResponse } from 'next/server';
import { streamCoachAdvice } from '@/lib/coachHandler';
import { preventionCoverageSchema as adviceSchema } from '@/lib/coachSchemas';
import { requireSession } from '@/lib/auth';
import { getUserLocale } from '@/lib/getLocale';
import { aiLanguageInstruction } from '@/lib/i18n';

const CACHE_KEY = 'prevention-coverage';

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const locale = await getUserLocale(userId);
    const { spentThisMonth, weightOnIncomePct, remaining, pendingReimbursementTotal, pendingCount, recordsCount, force } =
      await req.json();

    if (
      [spentThisMonth, weightOnIncomePct, remaining, pendingReimbursementTotal, pendingCount, recordsCount].some(
        (v) => typeof v !== 'number' || Number.isNaN(v),
      )
    ) {
      return NextResponse.json({ success: false, error: 'Données santé invalides' }, { status: 400 });
    }

    const systemPrompt = `Tu es un conseiller santé/prévoyance basé à Tanger, Maroc. Style: ultra concis, chiffré quand pertinent, jamais générique. Bonne connaissance du système marocain (CNSS, AMO, mutuelles privées, pharmacies, génériques). ${aiLanguageInstruction(locale)}`;

    const userPrompt = `Situation santé de l'utilisateur :
- Dépenses santé ce mois-ci : ${Math.round(spentThisMonth)} DH
- Poids des dépenses santé sur le revenu : ${weightOnIncomePct}%
- Budget santé restant ce mois-ci : ${Math.round(remaining)} DH
- Dossiers de remboursement en attente : ${pendingCount} dossier(s) pour un total de ${Math.round(pendingReimbursementTotal)} DH
- Nombre total de soins enregistrés : ${recordsCount}

Rédige 4 blocs de conseils courts et personnalisés à cette situation : Bilan de Santé Annuel, Couverture CNSS/AMO, Mutuelle Complémentaire, Pharmacie & Génériques.`;

    return await streamCoachAdvice({
      userId,
      locale,
      baseCacheKey: CACHE_KEY,
      input: { spentThisMonth, weightOnIncomePct, remaining, pendingReimbursementTotal, pendingCount, recordsCount },
      schema: adviceSchema,
      system: systemPrompt,
      prompt: userPrompt,
      force,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Prevention Coverage Coach Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
