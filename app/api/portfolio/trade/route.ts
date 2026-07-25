import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getHouseholdMemberIds } from '@/lib/household';

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const { accountId, tickerSymbol, action, shares, pricePerShare } = await req.json();

    if (!accountId || !tickerSymbol || !action || !shares || !pricePerShare) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const memberIds = await getHouseholdMemberIds(userId);
    const totalValue = shares * pricePerShare;

    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({
        where: { id: accountId, userId: { in: memberIds } },
      });

      if (!account) throw new Error('Account not found');

      const existingAsset = await tx.portfolioAsset.findFirst({
        where: { accountId, tickerSymbol, userId: { in: memberIds } },
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
              userId,
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
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Trade Engine Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status = message === 'Insufficient shares to sell' ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
