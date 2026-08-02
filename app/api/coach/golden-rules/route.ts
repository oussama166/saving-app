import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { getHouseholdContext } from '@/lib/household';
import { requireFeatureAccess } from '@/lib/features';
import { evaluateGoldenRules, captureGoldenRuleSnapshot, getGoldenRuleHistory } from '@/lib/goldenRules';

// Évaluation déterministe (pas d'IA) des Règles d'Or — score de conformité,
// détail par règle, historique et détection des règles nouvellement
// franchies. Voir lib/goldenRules.ts pour le calcul.
export async function GET() {
  try {
    const { userId } = await requireSession();
    await requireFeatureAccess('coach', userId);
    const ctx = await getHouseholdContext(userId);

    const evaluation = await evaluateGoldenRules(ctx);
    await captureGoldenRuleSnapshot(ctx, evaluation);
    const history = await getGoldenRuleHistory(ctx);

    return NextResponse.json({
      success: true,
      data: {
        results: evaluation.results,
        scorePct: evaluation.scorePct,
        scoredCount: evaluation.scoredCount,
        respectedCount: evaluation.respectedCount,
        history: history.points,
        newlyExceededRuleIds: history.newlyExceededRuleIds,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'FEATURE_DISABLED') {
      return NextResponse.json({ success: false, error: 'Cette fonctionnalité est temporairement désactivée.' }, { status: 403 });
    }
    console.error('Coach Golden Rules GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
