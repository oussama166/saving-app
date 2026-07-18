import { prisma } from "@/lib/prisma";
import yahooFinance from "yahoo-finance2";

/**
 * Fetches all portfolio assets and enriches them with live market data
 * (falls back to the average buy price if no quote is found — e.g. for
 * tickers not covered by Yahoo Finance). Shared between /api/portfolio/live
 * and /api/dashboard so both compute the portfolio value the same way.
 */
export async function getEnrichedPortfolioAssets(userId: string) {
  const assets = await prisma.portfolioAsset.findMany({
    where: { userId },
    include: {
      account: { select: { name: true } },
    },
  });

  const enrichedAssets = await Promise.all(
    assets.map(async (asset) => {
      const fallbackPrice = asset.averageBuyPrice;
      const costBasis = asset.sharesOwned * asset.averageBuyPrice;

      // Actifs à prix géré manuellement (Action MASI, OPCVM, Or...) : pas de
      // cotation Yahoo Finance disponible pour ces tickers, on fait confiance
      // au prix saisi à la main plutôt que de tenter un lookup qui échouera.
      if (asset.manualPrice != null) {
        const liveValue = asset.sharesOwned * asset.manualPrice;
        const profitAmount = liveValue - costBasis;
        const profitPercentage = costBasis !== 0 ? (profitAmount / costBasis) * 100 : 0;

        return {
          ...asset,
          livePrice: asset.manualPrice,
          costBasis,
          liveValue,
          profitAmount,
          profitPercentage,
          currency: "MAD",
        };
      }

      try {
        // yahoo-finance2 résout `quote()` en un type d'union géant selon les
        // "modules" demandés, que TS ne parvient pas toujours à réduire
        // correctement (résultat `never` observé ici) — on caste vers la
        // forme minimale réellement utilisée plutôt que de se battre contre
        // les surcharges de la lib.
        const quote = (await yahooFinance.quote(asset.tickerSymbol)) as {
          regularMarketPrice?: number;
          currency?: string;
        };
        const livePrice = quote.regularMarketPrice || fallbackPrice;

        const liveValue = asset.sharesOwned * livePrice;
        const profitAmount = liveValue - costBasis;
        const profitPercentage =
          costBasis !== 0 ? (profitAmount / costBasis) * 100 : 0;

        return {
          ...asset,
          livePrice,
          costBasis,
          liveValue,
          profitAmount,
          profitPercentage,
          currency: quote.currency || "MAD",
        };
      } catch (error) {
        console.error(`Error fetching quote for ${asset.tickerSymbol}:`, error);
        // Fallback to average buy price if quote fails and no manual price is set
        return {
          ...asset,
          livePrice: fallbackPrice,
          costBasis,
          liveValue: costBasis,
          profitAmount: 0,
          profitPercentage: 0,
          currency: "MAD",
        };
      }
    }),
  );

  const globalCostBasis = enrichedAssets.reduce(
    (acc, curr) => acc + curr.costBasis,
    0,
  );
  const globalLiveValue = enrichedAssets.reduce(
    (acc, curr) => acc + curr.liveValue,
    0,
  );
  const globalProfit = globalLiveValue - globalCostBasis;

  return { enrichedAssets, globalCostBasis, globalLiveValue, globalProfit };
}
