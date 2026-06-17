import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { accountId, tickerSymbol, action, shares, pricePerShare } = await req.json();

    if (!accountId || !tickerSymbol || !action || !shares || !pricePerShare) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const totalValue = shares * pricePerShare;

    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({
        where: { id: accountId },
      });

      if (!account) throw new Error('Account not found');

      const existingAsset = await tx.portfolioAsset.findFirst({
        where: { accountId, tickerSymbol },
      });

      if (action === 'BUY') {
        await tx.account.update({
          where: { id: accountId },
          data: { balance: { decrement: totalValue } },
        });

        if (existingAsset) {
          const newShares = existingAsset.sharesOwned + shares;
          const newAveragePrice =
            (existingAsset.sharesOwned * existingAsset.averageBuyPrice + totalValue) / newShares;

          return await tx.portfolioAsset.update({
            where: { id: existingAsset.id },
            data: {
              sharesOwned: newShares,
              averageBuyPrice: newAveragePrice,
            },
          });
        } else {
          return await tx.portfolioAsset.create({
            data: {
              accountId,
              tickerSymbol,
              sharesOwned: shares,
              averageBuyPrice: pricePerShare,
            },
          });
        }
      } else if (action === 'SELL') {
        if (!existingAsset || existingAsset.sharesOwned < shares) {
          throw new Error('Insufficient shares to sell');
        }

        await tx.account.update({
          where: { id: accountId },
          data: { balance: { increment: totalValue } },
        });

        return await tx.portfolioAsset.update({
          where: { id: existingAsset.id },
          data: {
            sharesOwned: { decrement: shares },
          },
        });
      } else {
        throw new Error('Invalid action');
      }
    });

    return NextResponse.json({ success: true, asset: result });
  } catch (error: any) {
    console.error('Trade Engine Error:', error);
    const status = error.message === 'Insufficient shares to sell' ? 400 : 500;
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}
