import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getBudgetOwnerUserId } from '@/lib/household';
import { detectCsvColumns } from '@/lib/csvImport';

// Étape 1 du flux d'import CSV "dynamique" : ne parse/n'importe RIEN, se
// contente de détecter le format (délimiteur, en-têtes, mapping deviné) et
// de vérifier si ce même format de fichier a déjà été mappé pour ce foyer
// (CsvImportProfile) — si oui, le mapping enregistré est renvoyé à la place
// du mapping deviné, pour un import silencieux la 2e fois. Sinon,
// l'utilisateur corrige le mapping deviné dans l'aperçu avant de confirmer
// via POST /api/transactions/import-csv.
export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    // Lecture en texte brut puis JSON.parse manuel : si la requête arrive
    // pendant un rechargement Turbopack (route recompilée en plein vol), le
    // corps peut arriver tronqué/vide — on veut un 400 propre plutôt qu'un
    // crash 500 sur req.json().
    const rawBody = await req.text();
    if (!rawBody) {
      return NextResponse.json({ success: false, error: 'Requête vide — réessaie.' }, { status: 400 });
    }
    let csv: unknown;
    try {
      ({ csv } = JSON.parse(rawBody) as { csv?: string });
    } catch {
      return NextResponse.json({ success: false, error: 'Corps de requête invalide — réessaie.' }, { status: 400 });
    }

    if (!csv || typeof csv !== 'string') {
      return NextResponse.json({ success: false, error: 'Champ "csv" requis' }, { status: 400 });
    }

    const detection = detectCsvColumns(csv);
    const budgetOwnerId = await getBudgetOwnerUserId(userId);

    const savedProfile = await prisma.csvImportProfile.findUnique({
      where: { userId_headerSignature: { userId: budgetOwnerId, headerSignature: detection.headerSignature } },
    });

    return NextResponse.json({
      success: true,
      data: {
        headerCells: detection.headerCells,
        headerRecognized: detection.headerRecognized,
        previewRows: detection.previewRows,
        headerSignature: detection.headerSignature,
        mapping: savedProfile
          ? {
              delimiter: savedProfile.delimiter,
              hasHeaderRow: savedProfile.hasHeaderRow,
              dateIdx: savedProfile.dateIdx,
              merchantIdx: savedProfile.merchantIdx,
              amountIdx: savedProfile.amountIdx,
              debitIdx: savedProfile.debitIdx,
              creditIdx: savedProfile.creditIdx,
            }
          : detection.mapping,
        fromSavedProfile: Boolean(savedProfile),
        savedProfileLabel: savedProfile?.bankLabel ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('CSV Preview Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
