import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { notifyRefresh } from '@/lib/sse';
import { parseBankCsv, parseBankCsvWithMapping, type CsvColumnMapping } from '@/lib/csvImport';
import { guessCategoryFromMerchantName } from '@/lib/placeCategory';
import { parseBankStatementLine, guessCategoryFromMcc } from '@/lib/bankStatementParser';
import { getHouseholdContext } from '@/lib/household';

const UNCATEGORIZED_NAME = 'Uncategorized';
// Réduit de 25 à 10 après une erreur P2028 en prod ("rollback cannot be
// executed on an expired transaction") : le timeout par défaut de Prisma
// pour un $transaction([...]) est 5000ms, et 25 créations séquentielles vers
// Turso (round-trip réseau à chaque écriture, pas un fichier local) peuvent
// largement dépasser ça. Un chunk plus petit + un timeout explicite plus
// généreux (voir plus bas) couvrent le cas d'un gros relevé sur une
// connexion lente.
const CHUNK_SIZE = 10;
const CHUNK_TRANSACTION_TIMEOUT_MS = 15000;

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
    // Même garde-fou que /api/transactions/csv-preview : lecture en texte
    // brut puis JSON.parse manuel pour éviter un crash 500 si le corps
    // arrive vide/tronqué (ex: requête envoyée pendant un rechargement
    // Turbopack de cette route).
    const rawBody = await req.text();
    if (!rawBody) {
      return NextResponse.json({ success: false, error: 'Requête vide — réessaie.' }, { status: 400 });
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: false, error: 'Corps de requête invalide — réessaie.' }, { status: 400 });
    }
    const {
      csv,
      accountId,
      mapping,
      headerSignature,
      saveProfile,
      bankLabel,
    } = body as {
      csv?: string;
      accountId?: string;
      // Mapping explicite (issu de l'aperçu /api/transactions/csv-preview,
      // éventuellement corrigé par l'utilisateur) — si absent, on retombe
      // sur l'auto-détection historique (voir lib/csvImport.ts).
      mapping?: CsvColumnMapping;
      headerSignature?: string;
      saveProfile?: boolean;
      bankLabel?: string;
    };

    if (!csv || typeof csv !== 'string') {
      return NextResponse.json({ success: false, error: 'Champ "csv" requis (contenu du fichier).' }, { status: 400 });
    }

    const ctx = await getHouseholdContext(userId);

    let account = accountId
      ? await prisma.account.findFirst({ where: { id: accountId, userId: { in: ctx.memberIds } } })
      : await prisma.account.findFirst({ where: { userId: { in: ctx.memberIds }, name: 'Main Checking' } });
    if (!account) {
      account = await prisma.account.findFirst({ where: { userId: { in: ctx.memberIds } }, orderBy: { createdAt: 'asc' } });
    }
    if (!account) {
      account = await prisma.account.create({
        data: { userId, name: 'Main Checking', type: 'checking', balance: 0 },
      });
    }

    const { rows, errors: parseErrors } = mapping ? parseBankCsvWithMapping(csv, mapping) : parseBankCsv(csv);

    // Mémorise ce mapping pour ce format de fichier (voir CsvImportProfile)
    // si demandé — la prochaine fois qu'un fichier avec la même signature
    // d'en-tête arrive, /api/transactions/csv-preview le reprendra
    // automatiquement sans redemander de mapping.
    if (mapping && headerSignature && saveProfile) {
      await prisma.csvImportProfile.upsert({
        where: { userId_headerSignature: { userId: ctx.budgetOwnerId, headerSignature } },
        update: { ...mapping, bankLabel: bankLabel || undefined },
        create: { userId: ctx.budgetOwnerId, headerSignature, bankLabel: bankLabel || null, ...mapping },
      });
    }

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
    // sans créer de doublons. La clé utilise désormais la description
    // NETTOYÉE (voir parseBankStatementLine plus bas) pour rester cohérente
    // avec ce qui sera effectivement stocké — les transactions déjà
    // importées avant ce nettoyage (libellé brut) ne matcheront pas et
    // pourront apparaître en double une seule fois, à nettoyer à la main.
    const minDate = new Date(Math.min(...rows.map((r) => r.date.getTime())));
    const maxDate = new Date(Math.max(...rows.map((r) => r.date.getTime())));
    maxDate.setHours(23, 59, 59, 999);
    const existing = await prisma.transaction.findMany({
      where: { userId: { in: ctx.memberIds }, accountId: account.id, date: { gte: minDate, lte: maxDate } },
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
      let category = await prisma.category.findFirst({ where: { userId: ctx.budgetOwnerId, name: categoryName } });
      if (!category) {
        category = await prisma.category.create({ data: { userId: ctx.budgetOwnerId, name: categoryName, type: 'expense' } });
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
      // Nettoyage du libellé brut de banque (retire numéro de carte masqué,
      // date déjà stockée par ailleurs, code MCC...) + extraction de la
      // méthode de paiement et d'éventuels indices de catégorie propres aux
      // opérations bancaires (commission, agios, virement...) — voir
      // lib/bankStatementParser.ts.
      const parsedLine = parseBankStatementLine(row.merchant);
      const cleanMerchant = parsedLine.cleanDescription || row.merchant;

      const key = `${dayKey(row.date)}|${row.amount}|${cleanMerchant.toLowerCase()}`;
      if (existingKeys.has(key)) {
        duplicatesSkipped += 1;
        continue;
      }
      existingKeys.add(key); // évite aussi les doublons internes au fichier lui-même

      // Priorité de catégorisation pour une dépense (jamais pour un revenu) :
      // 1. Catégorie déjà tranchée par le parseur de ligne bancaire
      //    (commission, agios, retrait GAB, facture télécom...) ;
      // 2. Mot-clé reconnu dans le libellé nettoyé (marque connue :
      //    "Marjane", "McDo", "Glovo"...) — plus fiable qu'un MCC générique
      //    quand disponible ;
      // 3. Code MCC (Merchant Category Code) fourni par la banque, en repli.
      const guess =
        row.amount < 0
          ? (parsedLine.categoryHint ?? guessCategoryFromMerchantName(cleanMerchant) ?? guessCategoryFromMcc(parsedLine.mcc))
          : null;
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
          paymentMethod: parsedLine.paymentMethod,
          merchant: cleanMerchant,
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
      // l'adapter libSQL/Turso à distance. `timeout` explicite (défaut
      // Prisma : 5000ms) pour laisser de la marge à la latence réseau réelle
      // vers Turso plutôt qu'un fichier SQLite local.
      await prisma.$transaction(
        chunk.map((c) => prisma.transaction.create(c)),
        { timeout: CHUNK_TRANSACTION_TIMEOUT_MS },
      );
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
