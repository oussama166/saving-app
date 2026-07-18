import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

export async function GET() {
  try {
    await requireAdminSession();

    const [byName, activeAgg, totalCount, distinctUsers] = await Promise.all([
      prisma.subscription.groupBy({
        by: ['name'],
        where: { isActive: true },
        _count: { _all: true },
        _sum: { price: true },
        orderBy: { _count: { name: 'desc' } },
      }),
      prisma.subscription.aggregate({ where: { isActive: true }, _sum: { price: true }, _count: true }),
      prisma.subscription.count(),
      prisma.subscription.findMany({ where: { isActive: true }, distinct: ['userId'], select: { userId: true } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        byName: byName.map((row) => ({
          name: row.name,
          count: row._count._all,
          totalMonthly: row._sum.price ?? 0,
        })),
        totals: {
          activeCount: activeAgg._count,
          totalCount,
          totalMonthlySpend: activeAgg._sum.price ?? 0,
          usersWithActiveSubscription: distinctUsers.length,
        },
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'ADMIN_UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Admin Subscriptions Stats Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
