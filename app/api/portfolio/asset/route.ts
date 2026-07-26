import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyRefresh } from '@/lib/sse';
import { requireSession } from '@/lib/auth';
import { getHouseholdMemberIds } from '@/lib/household';

const ASSET_TYPES = ['Action', 'ETF', 'Crypto', 'OPCVM', 'Or'] as const;

// Upsert simple d'un actif de portfolio — équivalent du formulaire
// "Ajouter ou mettre à jour un actif" du site 1. Différent du moteur
// app/api/portfolio/trade/route.ts (achat/vente avec impact sur le solde
// du compte) : ici on saisit juste la position telle qu'elle est.
export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const { id, name, assetType, sharesOwned, averageBuyPrice, manualPrice } = await req.json();

    if (!name || !assetType || !sharesOwned || !averageBuyPrice) {
      return NextResponse.json(
        { success: false, error: 'Nom, type, quantité et prix d\'achat sont requis' },
        { status: 400 },
      );
    }

    if (!ASSET_TYPES.includes(assetType)) {
      return NextResponse.json({ success: false, error: 'Type d\'actif invalide' }, { status: 400 });
    }

    const memberIds = await getHouseholdMemberIds(userId);

    if (id) {
      const existing = await prisma.portfolioAsset.findFirst({ where: { id, userId: { in: memberIds } } });
      if (!existing) {
        return NextResponse.json({ success: false, error: 'Actif introuvable' }, { status: 404 });
      }
    }

    let account = await prisma.account.findFirst({ where: { userId: { in: memberIds }, name: 'Portfolio' } });
    if (!account) {
      account = await prisma.account.create({
        data: { userId, name: 'Portfolio', type: 'investment', balance: 0 },
      });
    }

    const data = {
      userId,
      tickerSymbol: String(name),
      assetType: String(assetType),
      sharesOwned: Number(sharesOwned),
      averageBuyPrice: Number(averageBuyPrice),
      manualPrice: manualPrice !== undefined && manualPrice !== null && manualPrice !== '' ? Number(manualPrice) : null,
      accountId: account.id,
    };

    const asset = id
      ? await prisma.portfolioAsset.update({ where: { id }, data })
      : await prisma.portfolioAsset.create({ data });

    notifyRefresh();

    return NextResponse.json({ success: true, data: asset });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Portfolio Asset Upsert Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
