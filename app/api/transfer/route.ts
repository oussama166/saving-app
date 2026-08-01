import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { getHouseholdContext } from '@/lib/household';
import { executeTransfer } from '@/lib/transferEngine';

export async function POST(request: Request) {
  try {
    const { userId } = await requireSession();
    const { fromAccountId, toAccountId, amount } = await request.json();
    const ctx = await getHouseholdContext(userId);

    if (!fromAccountId || !toAccountId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid transfer details' }, { status: 400 });
    }

    const result = await executeTransfer(fromAccountId, toAccountId, amount, ctx.memberIds, ctx.budgetOwnerId);

    return NextResponse.json({ success: true, transaction: result });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Transfer Engine Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status = message === 'Insufficient funds' ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
