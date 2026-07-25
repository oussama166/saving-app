import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { notifyRefresh } from '@/lib/sse';
import { parseBankCsv } from '@/lib/csvImport';
import { guessCategoryFromMerchantName } from '@/lib/placeCategory';

const UNCATEGORIZED_NAME = 'Uncategorized';
const CHUNK_SIZE = 25; // évite un $transaction([...]) trop long sur un gros relevé

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Alternative aux webhooks iOS Shortcut (Apple Pay/SMS) : upload manuel d'un
// CSV de relevé bancaire, pour couvrir Android et les banques sans
// notification exploitable. Voir lib/csvImport.ts pour le parsing tolérant
// (délimiteur, format de date/montant variables).
export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    const body = await req.json();
    const { csv, accountId } = body as { csv?: string; accountId?: string };

    if (!csv || typeof csv !== 'string') {
      return NextResponse.json({ success: false, error: 'Champ "csv" requis (contenu du fichier).' }, { status: 400 });
    }

    let account = accountId
      ? await prisma.account.findFirst({ where: { id: accountId, userId } })
      : await prisma.account.findFirst({ where: { userId, name: 'Main Checking' } });
    if (!account) {
      account = await prisma.account.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
    }
    if (!account) {
      account = await prisma.account.create({
        data: { userId, name: 'Main Checking', type: 'checking', balance: 0 },
      });
    }

    const { rows, errors: parseErrors } = parseBankCsv(csv);

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        summary: { imported: 0, duplicatesSkipped: 0, errorCount: parseErrors.length },
        errors: parseErrors,
      });
    }

    // Dédoublonnage : une ligne est considérée déjà importée si une
    // transaction existe déjà pour ce compte avec la même date (jour), le
    // même montant et le même libellé — permet de relancer un import sur un
    // relevé qui se chevauche partiellement (ex: mois courant re-exporté)
    // sans créer de doublons.
    const minDate = new Date(Math.min(...rows.map((r) => r.date.getTime())));
    const maxDate = new Date(Math.max(...rows.map((r) => r.date.getTime())));
    maxDate.setHours(23, 59, 59, 999);
    const existing = await prisma.transaction.findMany({
      where: { userId, accountId: account.id, date: { gte: minDate, lte: maxDate } },
      select: { date: true, amount: true, merchant: true },
    });
    const existingKeys = new Set(existing.map((t) => `${dayKey(t.date)}|${t.amount}|${t.merchant.toLowerCase()}`));

    // Résolution des catégories par nom, mise en cache pour tout l'import —
    // évite une requête par ligne pour un même nom de catégorie deviné
    // plusieurs fois (ex: 20 lignes "Marjane").
    const categoryCache = new Map<string, string>(); // categoryName -> categoryId
    async function resolveCategoryId(categoryName: string): Promise<string> {
      const cached = categoryCache.get(categoryName);
      if (cached) return cached;
      let category = await prisma.category.findFirst({ where: { userId, name: categoryName } });
      if (!category) {
        category = await prisma.category.create({ data: { userId, name: categoryName, type: 'expense' } });
      }
      categoryCache.set(categoryName, category.id);
      return category.id;
    }

    let imported = 0;
    let duplicatesSkipped = 0;
    let totalDelta = 0;
    const rowErrors: { line: number; message: string }[] = [];
    const toCreate: { data: Prisma.TransactionCreateInput }[] = [];

    for (const row of rows) {
      const key = `${dayKey(row.date)}|${row.amount}|${row.merchant.toLowerCase()}`;
      if (existingKeys.has(key)) {
        duplicatesSkipped += 1;
        continue;
      }
      existingKeys.add(key); // évite aussi les doublons internes au fichier lui-même

      const guess = row.amount < 0 ? guessCategoryFromMerchantName(row.merchant) : null;
      const categoryName = guess?.categoryName ?? UNCATEGORIZED_NAME;
      let categoryId: string;
      try {
        categoryId = await resolveCategoryId(categoryName);
      } catch {
        rowErrors.push({ line: row.line, message: 'Erreur lors de la résolution de catégorie.' });
        continue;
      }

      toCreate.push({
        data: {
          user: { connect: { id: userId } },
          account: { connect: { id: account.id } },
          category: { connect: { id: categoryId } },
          subCategory: guess?.subCategoryName ?? null,
          merchant: row.merchant,
          amount: row.amount,
          date: row.date,
        },
      });
      totalDelta += row.amount;
      imported += 1;
    }

    for (let i = 0; i < toCreate.length; i += CHUNK_SIZE) {
      const chunk = toCreate.slice(i, i + CHUNK_SIZE);
      // $transaction([...]) en forme batch (pas interactive) — même choix
      // que les autres écritures groupées du projet, plus fiable contre
      // l'adapter libSQL/Turso à distance.
      await prisma.$transaction(chunk.map((c) => prisma.transaction.create(c)));
    }

    if (totalDelta !== 0) {
      await prisma.account.update({ where: { id: account.id }, data: { balance: { increment: totalDelta } } });
    }

    if (imported > 0) notifyRefresh();

    return NextResponse.json({
      success: true,
      summary: {
        imported,
        duplicatesSkipped,
        errorCount: parseErrors.length + rowErrors.length,
      },
      errors: [...parseErrors, ...rowErrors],
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('CSV Import Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
