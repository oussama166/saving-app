import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { getHouseholdDetails } from '@/lib/household';

export async function GET() {
  try {
    const { userId } = await requireSession();
    const details = await getHouseholdDetails(userId);
    return NextResponse.json({ success: true, data: details });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Household GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
