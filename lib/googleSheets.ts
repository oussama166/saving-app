import { google } from 'googleapis';

const SHEET_TAB_NAME = 'Archive';
const HEADER_ROW = [
  'Utilisateur',
  'Date',
  'Type',
  'Catégorie',
  'Sous-catégorie',
  'Méthode',
  'Description',
  'Montant (DH)',
];

// Exporté (pas seulement usage interne) pour permettre à
// scripts/test-google-sheets.ts de tester l'authentification/les permissions
// indépendamment de appendArchivedTransactions (qui, elle, écrit dans le
// vrai onglet "Archive" utilisé par le cron d'archivage réel).
export function getSheetsClient() {
  const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!email || !privateKey) {
    throw new Error(
      'GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY manquants dans les variables d\'environnement.',
    );
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

/**
 * Ajoute des lignes de transactions archivées à l'onglet "Archive" du Google
 * Sheet configuré. Crée l'onglet + la ligne d'en-tête s'ils n'existent pas
 * encore. Ne fait AUCUNE suppression côté base — c'est à l'appelant de
 * confirmer le succès de cet appel avant de supprimer quoi que ce soit.
 */
export async function appendArchivedTransactions(rows: (string | number)[][]) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID manquant dans les variables d\'environnement.');
  }

  const sheets = getSheetsClient();

  // S'assure que l'onglet "Archive" existe, sinon le crée avec l'en-tête.
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const tabExists = spreadsheet.data.sheets?.some((s) => s.properties?.title === SHEET_TAB_NAME);

  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: SHEET_TAB_NAME } } }],
      },
    });
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_TAB_NAME}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [HEADER_ROW] },
    });
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_TAB_NAME}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
}
