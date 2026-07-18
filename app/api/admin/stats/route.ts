import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

// Stats globales + "config système" en lecture seule. Il n'y a pas de modèle
// SystemConfig persisté dans ce projet (rien de configurable dynamiquement
// côté admin pour l'instant) — on expose donc l'état des variables d'env qui
// pilotent des fonctionnalités clés, pour que l'admin puisse diagnostiquer
// rapidement ("pourquoi les emails de vérification ne partent pas ?" etc.)
// sans avoir à se connecter au serveur.
export async function GET() {
  try {
    await requireAdminSession();

    const [
      totalUsers,
      verifiedUsers,
      suspendedUsers,
      totalAccounts,
      totalTransactions,
      totalSubscriptions,
      activeSubscriptions,
      goalsAgg,
      accountsAgg,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.user.count({ where: { isSuspended: true } }),
      prisma.account.count(),
      prisma.transaction.count(),
      prisma.subscription.count(),
      prisma.subscription.count({ where: { isActive: true } }),
      prisma.savingsGoal.aggregate({ _sum: { targetAmount: true, currentAmount: true }, _count: true }),
      prisma.account.aggregate({ _sum: { balance: true } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        users: { total: totalUsers, verified: verifiedUsers, suspended: suspendedUsers },
        accounts: { total: totalAccounts, totalBalance: accountsAgg._sum.balance ?? 0 },
        transactions: { total: totalTransactions },
        subscriptions: { total: totalSubscriptions, active: activeSubscriptions },
        savingsGoals: {
          total: goalsAgg._count,
          totalTarget: goalsAgg._sum.targetAmount ?? 0,
          totalSaved: goalsAgg._sum.currentAmount ?? 0,
        },
        system: {
          nodeEnv: process.env.NODE_ENV ?? 'development',
          emailConfigured: Boolean(process.env.RESEND_API_KEY),
          authSecretConfigured: Boolean(process.env.AUTH_SECRET),
          adminAuthSecretConfigured: Boolean(process.env.ADMIN_AUTH_SECRET),
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
        },
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'ADMIN_UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Admin Stats Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
