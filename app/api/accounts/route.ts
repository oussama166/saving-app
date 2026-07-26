import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getHouseholdContext } from '@/lib/household';
import { SUPPORTED_CURRENCIES } from '@/lib/exchangeRates';

const ACCOUNT_TYPES = ['checking', 'savings', 'investment'];

// Pas de page "Comptes" dédiée dans l'app avant multi-devise : les comptes
// se créaient jusque-là implicitement (ex: "Main Checking" auto-créé au
// premier virement/salaire, voir lib/seedDefaults.ts). Cette route donne
// enfin un moyen explicite d'ajouter un compte — utile surtout pour un
// compte en devise étrangère (Wise/Payoneer en USD/EUR...), qui n'a pas de
// raison d'être créé automatiquement.
export async function GET() {
  try {
    const { userId } = await requireSession();
    const ctx = await getHouseholdContext(userId);

    const accounts = await prisma.account.findMany({
      where: { userId: { in: ctx.memberIds } },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, data: accounts, currencies: SUPPORTED_CURRENCIES });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Accounts GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const { name, type, currency, balance } = (await req.json()) as {
      name?: string;
      type?: string;
      currency?: string;
      balance?: number | string;
    };

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Nom du compte requis' }, { status: 400 });
    }
    if (type !== undefined && !ACCOUNT_TYPES.includes(type)) {
      return NextResponse.json({ success: false, error: 'Type de compte invalide' }, { status: 400 });
    }
    const resolvedCurrency = currency || 'MAD';
    if (!SUPPORTED_CURRENCIES.includes(resolvedCurrency as (typeof SUPPORTED_CURRENCIES)[number])) {
      return NextResponse.json({ success: false, error: 'Devise non supportée' }, { status: 400 });
    }
    const initialBalance = balance !== undefined && balance !== null && balance !== '' ? Number(balance) : 0;
    if (!Number.isFinite(initialBalance)) {
      return NextResponse.json({ success: false, error: 'Solde initial invalide' }, { status: 400 });
    }

    const account = await prisma.account.create({
      data: {
        userId,
        name: name.trim(),
        type: type || 'checking',
        currency: resolvedCurrency,
        balance: initialBalance,
      },
    });

    return NextResponse.json({ success: true, data: account });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Accounts POST Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
