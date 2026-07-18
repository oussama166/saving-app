import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

const PAGE_SIZE = 25;

type StatusFilter = 'all' | 'active' | 'suspended' | 'unverified';
type SortOption = 'createdAt_desc' | 'createdAt_asc' | 'balance_desc' | 'balance_asc';

export async function GET(req: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() ?? '';
    const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
    const status = (searchParams.get('status') as StatusFilter) || 'all';
    const sort = (searchParams.get('sort') as SortOption) || 'createdAt_desc';

    const where = {
      ...(q ? { OR: [{ email: { contains: q } }, { name: { contains: q } }] } : {}),
      ...(status === 'active' ? { isSuspended: false } : {}),
      ...(status === 'suspended' ? { isSuspended: true } : {}),
      ...(status === 'unverified' ? { emailVerified: false } : {}),
    };

    const baseSelect = {
      id: true,
      email: true,
      name: true,
      emailVerified: true,
      isSuspended: true,
      suspendedAt: true,
      createdAt: true,
      _count: { select: { accounts: true, transactions: true, subscriptions: true, savingsGoals: true } },
    } as const;

    if (sort === 'balance_desc' || sort === 'balance_asc') {
      // Le solde total est calculé (somme des comptes), pas une colonne SQL
      // triable directement — on trie en mémoire. Acceptable à l'échelle
      // d'une app perso (peu d'utilisateurs), pas conçu pour des dizaines de
      // milliers de comptes.
      const all = await prisma.user.findMany({
        where,
        select: { ...baseSelect, accounts: { select: { balance: true } } },
      });
      const withBalance = all.map((u) => {
        const totalBalance = u.accounts.reduce((sum, a) => sum + a.balance, 0);
        const row: Record<string, unknown> = { ...u, totalBalance };
        delete row.accounts;
        return row as typeof u & { totalBalance: number };
      });
      withBalance.sort((a, b) => (sort === 'balance_desc' ? b.totalBalance - a.totalBalance : a.totalBalance - b.totalBalance));
      const total = withBalance.length;
      const pageItems = withBalance.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

      return NextResponse.json({
        success: true,
        data: pageItems,
        pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
      });
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: sort === 'createdAt_asc' ? 'asc' : 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: baseSelect,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: users,
      pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'ADMIN_UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Admin Users List Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
