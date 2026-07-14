import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { appendArchivedTransactions } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

/**
 * Archive + nettoie les transactions plus vieilles que BACKUP_ARCHIVE_MONTHS
 * (3 par défaut), pour TOUS les utilisateurs : les exporte vers Google
 * Sheets, cumule leur impact dans CategoryArchive par catégorie, puis les
 * supprime de la base. La suppression ne se fait QUE si l'export Sheets a
 * réussi, par utilisateur.
 *
 * Protégé par un header `x-backup-secret` (pas par la session cookie —
 * exclu de la protection middleware, voir middleware.ts) — pensé pour être
 * appelé par un job planifié externe (cron-job.org, Netlify Scheduled
 * Functions, etc.), pas depuis le navigateur.
 */
export async function POST(req: Request) {
  try {
    const secret = req.headers.get('x-backup-secret');
    if (!process.env.BACKUP_SECRET || secret !== process.env.BACKUP_SECRET) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const months = Number(process.env.BACKUP_ARCHIVE_MONTHS ?? 3);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const users = await prisma.user.findMany({ select: { id: true, email: true } });

    let totalArchived = 0;
    const perUserResults: { userId: string; archived: number }[] = [];

    for (const user of users) {
      const transactions = await prisma.transaction.findMany({
        where: { userId: user.id, date: { lt: cutoff } },
        include: { category: true },
        orderBy: { date: 'asc' },
      });

      if (transactions.length === 0) {
        perUserResults.push({ userId: user.id, archived: 0 });
        continue;
      }

      // 1. Export vers Google Sheets — si ça échoue pour cet utilisateur, on
      // passe au suivant sans rien supprimer pour lui.
      const rows = transactions.map((tx) => [
        user.email,
        tx.date.toISOString().split('T')[0],
        tx.category.type,
        tx.category.name,
        tx.subCategory ?? '',
        tx.paymentMethod ?? '',
        tx.merchant,
        tx.amount,
      ]);

      try {
        await appendArchivedTransactions(rows);
      } catch (err) {
        console.error(`Backup Archive Error (user ${user.id}):`, err);
        perUserResults.push({ userId: user.id, archived: 0 });
        continue;
      }

      // 2. Cumule le total archivé par catégorie (pour préserver les calculs
      // "depuis le début" comme le solde du Fonds d'Urgence) puis supprime.
      const totalsByCategory = new Map<string, number>();
      for (const tx of transactions) {
        totalsByCategory.set(tx.categoryId, (totalsByCategory.get(tx.categoryId) ?? 0) + tx.amount);
      }

      await prisma.$transaction([
        ...Array.from(totalsByCategory.entries()).map(([categoryId, total]) =>
          prisma.categoryArchive.upsert({
            where: { categoryId },
            update: { archivedTotal: { increment: total }, lastArchivedAt: new Date() },
            create: { categoryId, archivedTotal: total, lastArchivedAt: new Date() },
          }),
        ),
        prisma.transaction.deleteMany({ where: { id: { in: transactions.map((t) => t.id) } } }),
      ]);

      totalArchived += transactions.length;
      perUserResults.push({ userId: user.id, archived: transactions.length });
    }

    return NextResponse.json({ success: true, archived: totalArchived, cutoff, perUser: perUserResults });
  } catch (error) {
    console.error('Backup Archive Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
