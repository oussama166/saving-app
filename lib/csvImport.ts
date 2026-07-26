// Parsing tolérant de CSV de relevé bancaire — les banques marocaines
// exportent dans des formats assez variés (délimiteur virgule ou
// point-virgule, montant en une colonne signée ou en deux colonnes
// débit/crédit séparées, dates en DD/MM/YYYY ou YYYY-MM-DD, en-têtes qui ne
// matchent pas toujours nos motifs FR/EN reconnus...). Plutôt que de
// deviner en silence et risquer un import mal aligné, le flux est en deux
// temps :
// 1. detectCsvColumns() : sniff délimiteur + en-têtes + une "meilleure
//    estimation" de mapping, SANS parser les lignes — sert à afficher un
//    aperçu (voir /api/transactions/csv-preview) que l'utilisateur peut
//    corriger avant de confirmer.
// 2. parseBankCsvWithMapping() : parse RÉELLEMENT les lignes avec un mapping
//    explicite (deviné à l'étape 1, corrigé par l'utilisateur, ou repris
//    d'un CsvImportProfile déjà enregistré pour ce même format d'en-tête —
//    voir prisma/schema.prisma).

export interface ParsedCsvRow {
  line: number; // numéro de ligne dans le fichier (1-based, en-tête compris) — pour les messages d'erreur
  date: Date;
  merchant: string;
  amount: number; // négatif = dépense, positif = revenu (déjà signé)
}

export interface CsvParseError {
  line: number;
  message: string;
}

export interface CsvParseResult {
  rows: ParsedCsvRow[];
  errors: CsvParseError[];
}

// Mapping explicite des colonnes — soit `amountIdx` (une colonne signée),
// soit `debitIdx`/`creditIdx` (deux colonnes séparées), jamais les deux à
// vide. -1 = colonne absente.
export interface CsvColumnMapping {
  delimiter: string;
  hasHeaderRow: boolean; // false = la 1ère ligne est déjà une donnée (repli positionnel)
  dateIdx: number;
  merchantIdx: number;
  amountIdx: number;
  debitIdx: number;
  creditIdx: number;
}

export interface CsvDetectionResult {
  mapping: CsvColumnMapping;
  headerCells: string[]; // en-têtes bruts (tels quels dans le fichier), [] si hasHeaderRow=false
  headerRecognized: boolean; // true si detecté par en-tête, false si repli positionnel (à vérifier par l'utilisateur)
  previewRows: string[][]; // 5 premières lignes de DONNÉES (hors en-tête), pour l'aperçu UI
  // Signature stable de la structure de ce fichier (délimiteur + en-têtes
  // normalisés) — sert de clé pour retrouver/enregistrer un
  // CsvImportProfile (voir app/api/transactions/csv-preview/route.ts).
  headerSignature: string;
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function detectDelimiter(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  const tabs = (headerLine.match(/\t/g) ?? []).length;
  if (tabs > semicolons && tabs > commas) return '\t';
  return semicolons >= commas ? ';' : ',';
}

// Découpe une ligne CSV en respectant les guillemets ("valeur, avec virgule").
function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

const DATE_HEADERS = ['date', 'date operation', 'date valeur', 'date transaction'];
const MERCHANT_HEADERS = ['libelle', 'description', 'merchant', 'label', 'intitule', 'detail', 'operation'];
const AMOUNT_HEADERS = ['montant', 'amount', 'montant mad', 'montant dh'];
const DEBIT_HEADERS = ['debit', 'debit mad'];
const CREDIT_HEADERS = ['credit', 'credit mad'];

function parseAmount(raw: string): number | null {
  if (!raw) return null;
  // Format FR courant : "1 234,56" ou "1234,56" ou "-45.00" — retire les
  // espaces (séparateurs de milliers), remplace la virgule décimale par un
  // point, retire un éventuel symbole de devise.
  const cleaned = raw
    .replace(/[^\d,.\-]/g, '')
    .replace(/\s/g, '');
  if (!cleaned) return null;
  // Si la chaîne contient à la fois "," et "." on suppose que "." est le
  // séparateur de milliers et "," le séparateur décimal (convention FR).
  let normalized = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.');
  }
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function parseDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // YYYY-MM-DD (ISO)
  let m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  // DD/MM/YYYY ou DD-MM-YYYY
  m = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function splitLines(csvText: string): string[] {
  return csvText.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
}

/**
 * Sniff le fichier (délimiteur, en-têtes, meilleure estimation de mapping)
 * sans parser les lignes — sert à construire l'aperçu de mapping affiché à
 * l'utilisateur (voir /api/transactions/csv-preview) avant tout import réel.
 */
export function detectCsvColumns(csvText: string): CsvDetectionResult {
  const lines = splitLines(csvText);
  if (lines.length === 0) {
    const emptyMapping: CsvColumnMapping = {
      delimiter: ',',
      hasHeaderRow: false,
      dateIdx: 0,
      merchantIdx: 1,
      amountIdx: 2,
      debitIdx: -1,
      creditIdx: -1,
    };
    return { mapping: emptyMapping, headerCells: [], headerRecognized: false, previewRows: [], headerSignature: 'empty' };
  }

  const delimiter = detectDelimiter(lines[0]);
  const rawHeaderCells = splitCsvLine(lines[0], delimiter);
  const normalizedHeaderCells = rawHeaderCells.map(normalizeHeader);

  const findIndex = (candidates: string[]) => normalizedHeaderCells.findIndex((h) => candidates.includes(h));
  let dateIdx = findIndex(DATE_HEADERS);
  let merchantIdx = findIndex(MERCHANT_HEADERS);
  let amountIdx = findIndex(AMOUNT_HEADERS);
  const debitIdx = findIndex(DEBIT_HEADERS);
  const creditIdx = findIndex(CREDIT_HEADERS);

  const headerRecognized = dateIdx !== -1 && merchantIdx !== -1 && (amountIdx !== -1 || (debitIdx !== -1 && creditIdx !== -1));

  if (!headerRecognized) {
    // Repli positionnel : colonne 0 = date, 1 = libellé, 2 = montant — ordre
    // le plus courant dans les exports bancaires marocains sans en-tête
    // reconnu. À confirmer/corriger par l'utilisateur dans l'aperçu.
    dateIdx = 0;
    merchantIdx = 1;
    amountIdx = 2;
  }

  const dataStartLine = headerRecognized ? 1 : 0;
  const previewRows = lines.slice(dataStartLine, dataStartLine + 5).map((l) => splitCsvLine(l, delimiter));

  // Signature stable : délimiteur + en-têtes normalisés joints — deux
  // exports du même compte/de la même banque produisent la même signature
  // d'une fois sur l'autre, ce qui permet de retrouver un CsvImportProfile
  // déjà enregistré. Si pas d'en-tête reconnu, on inclut aussi le nombre de
  // colonnes de la 1ère ligne (repli positionnel — moins précis mais mieux
  // que rien).
  const headerSignature = headerRecognized
    ? `h:${delimiter}:${normalizedHeaderCells.join('|')}`
    : `p:${delimiter}:cols${rawHeaderCells.length}`;

  return {
    mapping: { delimiter, hasHeaderRow: headerRecognized, dateIdx, merchantIdx, amountIdx, debitIdx, creditIdx },
    headerCells: rawHeaderCells,
    headerRecognized,
    previewRows,
    headerSignature,
  };
}

/**
 * Parse le CSV avec un mapping de colonnes EXPLICITE (issu de
 * detectCsvColumns(), corrigé par l'utilisateur, ou repris d'un
 * CsvImportProfile enregistré) — jamais de re-détection ici.
 */
export function parseBankCsvWithMapping(csvText: string, mapping: CsvColumnMapping): CsvParseResult {
  const lines = splitLines(csvText);
  const rows: ParsedCsvRow[] = [];
  const errors: CsvParseError[] = [];

  if (lines.length === 0) {
    return { rows, errors: [{ line: 0, message: 'Fichier vide.' }] };
  }

  const { delimiter, hasHeaderRow, dateIdx, merchantIdx, amountIdx, debitIdx, creditIdx } = mapping;
  const dataStartLine = hasHeaderRow ? 1 : 0;

  for (let i = dataStartLine; i < lines.length; i++) {
    const lineNumber = i + 1;
    const cells = splitCsvLine(lines[i], delimiter);

    const dateRaw = cells[dateIdx];
    const merchantRaw = cells[merchantIdx];
    const date = dateRaw ? parseDate(dateRaw) : null;

    let amount: number | null = null;
    if (amountIdx !== -1) {
      amount = cells[amountIdx] ? parseAmount(cells[amountIdx]) : null;
    } else if (debitIdx !== -1 || creditIdx !== -1) {
      const debit = debitIdx !== -1 ? parseAmount(cells[debitIdx]) ?? 0 : 0;
      const credit = creditIdx !== -1 ? parseAmount(cells[creditIdx]) ?? 0 : 0;
      amount = credit - Math.abs(debit);
    }

    if (!date) {
      errors.push({ line: lineNumber, message: `Date illisible : "${dateRaw ?? ''}".` });
      continue;
    }
    if (amount === null || amount === 0) {
      errors.push({ line: lineNumber, message: `Montant illisible ou nul : "${cells[amountIdx] ?? ''}".` });
      continue;
    }
    if (!merchantRaw) {
      errors.push({ line: lineNumber, message: 'Libellé manquant.' });
      continue;
    }

    rows.push({ line: lineNumber, date, merchant: merchantRaw, amount });
  }

  return { rows, errors };
}

/**
 * Raccourci pratique : détecte le mapping puis parse dans la foulée — utilisé
 * quand on ne veut pas du flux d'aperçu (ex: tests, ou un futur webhook CSV
 * automatisé où personne ne peut corriger le mapping à la main).
 */
export function parseBankCsv(csvText: string): CsvParseResult {
  const { mapping } = detectCsvColumns(csvText);
  return parseBankCsvWithMapping(csvText, mapping);
}
