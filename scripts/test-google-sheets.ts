/**
 * Vérifie que GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY /
 * GOOGLE_SHEETS_SPREADSHEET_ID sont corrects ET que le compte de service a
 * bien accès au spreadsheet (partage oublié = erreur la plus fréquente).
 *
 * Ne touche JAMAIS l'onglet "Archive" réel (utilisé par le cron
 * /api/backup/archive, voir lib/googleSheets.ts::appendArchivedTransactions)
 * — écrit une ligne de test dans un onglet séparé "TestConnexion" à la
 * place, pour ne pas polluer les vraies données archivées.
 *
 * Usage :
 *   npm run test-sheets
 */
import 'dotenv/config';
import { getSheetsClient } from '../lib/googleSheets';

const TEST_TAB_NAME = 'TestConnexion';

// Diagnostic de FORMAT uniquement — ne loggue jamais le contenu de la clé
// (secret), seulement sa forme. "error:1E08010C:DECODER routines::unsupported"
// (erreur OpenSSL) veut dire que Node n'arrive pas à parser la clé PEM, quasi
// toujours à cause d'un copier-coller cassé dans .env (retours à la ligne
// réels au lieu de \n échappés, guillemets mal fermés, ligne tronquée...).
function diagnoseKeyFormat() {
  const raw = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  if (!raw) {
    console.error('  GOOGLE_SHEETS_PRIVATE_KEY est vide/absent.');
    return;
  }
  const hasLiteralNewlines = raw.includes('\n');
  const hasEscapedNewlines = raw.includes('\\n');
  const unescaped = raw.replace(/\\n/g, '\n').trim();
  const startsOk = unescaped.startsWith('-----BEGIN PRIVATE KEY-----');
  const endsOk = unescaped.endsWith('-----END PRIVATE KEY-----');

  console.error(`  Longueur brute : ${raw.length} caractères`);
  console.error(`  Contient des vrais retours à la ligne : ${hasLiteralNewlines ? 'oui' : 'non'}`);
  console.error(`  Contient des \\n échappés : ${hasEscapedNewlines ? 'oui' : 'non'}`);
  console.error(`  Commence par "-----BEGIN PRIVATE KEY-----" (après dé-échappement) : ${startsOk ? 'oui' : 'NON ← problème'}`);
  console.error(`  Finit par "-----END PRIVATE KEY-----" (après dé-échappement) : ${endsOk ? 'oui' : 'NON ← problème'}`);

  if (hasLiteralNewlines && hasEscapedNewlines) {
    console.error(
      '\n  → Mélange de vrais retours à la ligne ET de \\n échappés : le copier-coller a probablement cassé le format. Recopie la valeur "private_key" du JSON telle quelle, sur UNE seule ligne dans .env, entre guillemets.',
    );
  } else if (!startsOk || !endsOk) {
    console.error(
      '\n  → La clé semble tronquée ou incomplète. Recopie tout le champ "private_key" du fichier JSON du compte de service, sans rien couper.',
    );
  }
}

async function main() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    console.error('GOOGLE_SHEETS_SPREADSHEET_ID manquant dans .env');
    process.exit(1);
  }

  console.log('→ Authentification avec le compte de service...');
  const sheets = getSheetsClient();

  console.log(`→ Lecture des métadonnées du spreadsheet ${spreadsheetId}...`);
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  console.log(`✓ Accès confirmé — titre du spreadsheet : "${spreadsheet.data.properties?.title}"`);
  console.log(`  Onglets existants : ${spreadsheet.data.sheets?.map((s) => s.properties?.title).join(', ')}`);

  const tabExists = spreadsheet.data.sheets?.some((s) => s.properties?.title === TEST_TAB_NAME);
  if (!tabExists) {
    console.log(`→ Création de l'onglet de test "${TEST_TAB_NAME}"...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: TEST_TAB_NAME } } }] },
    });
  }

  console.log('→ Écriture d\'une ligne de test...');
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${TEST_TAB_NAME}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[new Date().toISOString(), 'Test de connexion WealthOS — OK']] },
  });

  console.log(`\n✓ Tout fonctionne. Va vérifier l'onglet "${TEST_TAB_NAME}" dans ton Google Sheet.`);
  console.log('  (tu peux supprimer cet onglet à la main une fois vérifié, il n\'est pas utilisé par l\'app)');
}

main().catch((err) => {
  console.error('\n✗ Échec :', err.message || err);
  if (err.message?.includes('PERMISSION_DENIED') || err.code === 403) {
    console.error(
      '\n→ Cause probable : le Google Sheet n\'est pas partagé avec l\'email du compte de service (GOOGLE_SHEETS_CLIENT_EMAIL), en rôle Éditeur.',
    );
  }
  if (err.message?.includes('DECODER routines') || err.message?.includes('unsupported')) {
    console.error('\n→ Erreur de format de clé privée (OpenSSL n\'arrive pas à la parser). Diagnostic :\n');
    diagnoseKeyFormat();
  }
  process.exit(1);
});
