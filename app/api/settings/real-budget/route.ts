import { NextResponse } from 'next/server';
import { getRealBudgetSummary } from '@/lib/financials';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureUserSeeded } from '@/lib/seedDefaults';
import { getHouseholdContext } from '@/lib/household';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { userId } = await requireSession();

    // Filet de sécurité : comptes créés avant le passage à Turso (ou dont le
    // seed initial a échoué en route, ex: timeout réseau) — voir
    // lib/seedDefaults.ts. No-op si le compte est déjà correctement seedé.
    await ensureUserSeeded(prisma, userId);

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') === 'all' ? 'all' : 'month';

    const ctx = await getHouseholdContext(userId);
    const data = await getRealBudgetSummary(ctx, period);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Real Budget GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
