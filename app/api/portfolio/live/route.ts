import { NextResponse } from 'next/server';
import { getEnrichedPortfolioAssets } from '@/lib/portfolio';
import { requireSession } from '@/lib/auth';
import { getHouseholdContext } from '@/lib/household';

export async function GET() {
  try {
    const { userId } = await requireSession();
    const ctx = await getHouseholdContext(userId);
    const { enrichedAssets, globalCostBasis, globalLiveValue, globalProfit } =
      await getEnrichedPortfolioAssets(ctx);

    return NextResponse.json({
      globalCostBasis,
      globalLiveValue,
      globalProfit,
      assets: enrichedAssets,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Portfolio API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
