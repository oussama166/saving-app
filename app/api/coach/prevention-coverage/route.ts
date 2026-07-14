import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { coachModel } from '@/lib/aiProvider';
import { getCachedAdvice, setCachedAdvice } from '@/lib/aiCache';
import { requireSession } from '@/lib/auth';

const CACHE_KEY = 'prevention-coverage';

const adviceSchema = z.object({
  bilanAnnuel: z
    .string()
    .describe("2 phrases courtes: conseil de bilan de santé préventif, adapté au budget santé actuel de l'utilisateur."),
  couvertureCnss: z
    .string()
    .describe('2 phrases courtes: conseil sur la couverture CNSS/AMO, tenant compte des dossiers de remboursement en attente.'),
  mutuelle: z
    .string()
    .describe("2 phrases courtes: conseil sur une mutuelle complémentaire, adapté au poids réel des dépenses santé sur le revenu."),
  pharmacieGeneriques: z
    .string()
    .describe('2 phrases courtes: conseil pratique pour réduire la facture pharmacie/médicaments.'),
});

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const { spentThisMonth, weightOnIncomePct, remaining, pendingReimbursementTotal, pendingCount, recordsCount } =
      await req.json();

    if (
      [spentThisMonth, weightOnIncomePct, remaining, pendingReimbursementTotal, pendingCount, recordsCount].some(
        (v) => typeof v !== 'number' || Number.isNaN(v),
      )
    ) {
      return NextResponse.json({ success: false, error: 'Données santé invalides' }, { status: 400 });
    }

    // 1. Cache hebdomadaire — évite un appel LLM à chaque chargement de page.
    const cached = await getCachedAdvice<{
      bilanAnnuel: string;
      couvertureCnss: string;
      mutuelle: string;
      pharmacieGeneriques: string;
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
    const systemPrompt = `Tu es un conseiller santé/prévoyance basé à Tanger, Maroc. Style: ultra concis, chiffré quand pertinent, jamais générique. Bonne connaissance du système marocain (CNSS, AMO, mutuelles privées, pharmacies, génériques).`;

    const userPrompt = `Situation santé de l'utilisateur :
- Dépenses santé ce mois-ci : ${Math.round(spentThisMonth)} DH
- Poids des dépenses santé sur le revenu : ${weightOnIncomePct}%
- Budget santé restant ce mois-ci : ${Math.round(remaining)} DH
- Dossiers de remboursement en attente : ${pendingCount} dossier(s) pour un total de ${Math.round(pendingReimbursementTotal)} DH
- Nombre total de soins enregistrés : ${recordsCount}

Rédige 4 blocs de conseils courts et personnalisés à cette situation : Bilan de Santé Annuel, Couverture CNSS/AMO, Mutuelle Complémentaire, Pharmacie & Génériques.`;

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
    console.error('Prevention Coverage Coach Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
