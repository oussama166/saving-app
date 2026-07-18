import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

const COLUMNS = [
  'id',
  'email',
  'name',
  'emailVerified',
  'isSuspended',
  'suspendedReason',
  'createdAt',
  'accounts',
  'transactions',
  'subscriptions',
  'savingsGoals',
  'totalBalance',
] as const;

export async function GET() {
  try {
    await requireAdminSession();

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        isSuspended: true,
        suspendedReason: true,
        createdAt: true,
        accounts: { select: { balance: true } },
        _count: { select: { accounts: true, transactions: true, subscriptions: true, savingsGoals: true } },
      },
    });

    const rows = users.map((u) => {
      const totalBalance = u.accounts.reduce((sum, a) => sum + a.balance, 0);
      return [
        u.id,
        u.email,
        u.name ?? '',
        u.emailVerified,
        u.isSuspended,
        u.suspendedReason ?? '',
        u.createdAt.toISOString(),
        u._count.accounts,
        u._count.transactions,
        u._count.subscriptions,
        u._count.savingsGoals,
        totalBalance,
      ];
    });

    const csv = [COLUMNS.join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="wealthos-users-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'ADMIN_UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Admin Users Export Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
