import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getBudgetOwnerUserId } from '@/lib/household';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { userId } = await requireSession();
    const budgetOwnerId = await getBudgetOwnerUserId(userId);
    const categories = await prisma.category.findMany({
      where: { userId: budgetOwnerId },
      orderBy: { order: 'asc' },
      include: {
        subCategories: { orderBy: { name: 'asc' } },
      },
    });

    return NextResponse.json({ success: true, data: categories });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Categories API Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
