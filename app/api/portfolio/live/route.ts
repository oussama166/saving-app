import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import yahooFinance from 'yahoo-finance2';

export async function GET() {
  try {
    const assets = await prisma.portfolioAsset.findMany({
      include: {
        account: {
          select: { name: true }
        }
      }
    });

    const enrichedAssets = await Promise.all(
      assets.map(async (asset) => {
        try {
          const quote = await yahooFinance.quote(asset.tickerSymbol);
          const livePrice = quote.regularMarketPrice || asset.averageBuyPrice;
          
          const costBasis = asset.sharesOwned * asset.averageBuyPrice;
          const liveValue = asset.sharesOwned * livePrice;
          const profitAmount = liveValue - costBasis;
          const profitPercentage = costBasis !== 0 ? (profitAmount / costBasis) * 100 : 0;

          return {
            ...asset,
            livePrice,
            costBasis,
            liveValue,
            profitAmount,
            profitPercentage,
            currency: quote.currency || 'USD'
          };
        } catch (error) {
          console.error(`Error fetching quote for ${asset.tickerSymbol}:`, error);
          // Fallback to average buy price if quote fails
          const costBasis = asset.sharesOwned * asset.averageBuyPrice;
          return {
            ...asset,
            livePrice: asset.averageBuyPrice,
            costBasis,
            liveValue: costBasis,
            profitAmount: 0,
            profitPercentage: 0,
            currency: 'USD'
          };
        }
      })
    );

    const globalCostBasis = enrichedAssets.reduce((acc, curr) => acc + curr.costBasis, 0);
    const globalLiveValue = enrichedAssets.reduce((acc, curr) => acc + curr.liveValue, 0);
    const globalProfit = globalLiveValue - globalCostBasis;

    return NextResponse.json({
      globalCostBasis,
      globalLiveValue,
      globalProfit,
      assets: enrichedAssets,
    });
  } catch (error) {
    console.error('Portfolio API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
