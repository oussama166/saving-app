// Parsing tolérant de CSV de relevé bancaire — les banques marocaines
// exportent dans des formats assez variés (délimiteur virgule ou
// point-virgule, montant en une colonne signée ou en deux colonnes
// débit/crédit séparées, dates en DD/MM/YYYY ou YYYY-MM-DD...). Plutôt que
// d'exiger un format unique, on détecte automatiquement les colonnes par
// leur en-tête (FR/EN, insensible à la casse/aux accents) et on retombe sur
// un ordre positionnel (date, libellé, montant) si les en-têtes ne sont pas
// reconnus.

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

export function parseBankCsv(csvText: string): CsvParseResult {
  const lines = csvText.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  const rows: ParsedCsvRow[] = [];
  const errors: CsvParseError[] = [];

  if (lines.length === 0) {
    return { rows, errors: [{ line: 0, message: 'Fichier vide.' }] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headerCells = splitCsvLine(lines[0], delimiter).map(normalizeHeader);

  const findIndex = (candidates: string[]) => headerCells.findIndex((h) => candidates.includes(h));
  let dateIdx = findIndex(DATE_HEADERS);
  let merchantIdx = findIndex(MERCHANT_HEADERS);
  let amountIdx = findIndex(AMOUNT_HEADERS);
  const debitIdx = findIndex(DEBIT_HEADERS);
  const creditIdx = findIndex(CREDIT_HEADERS);

  const headerRecognized = dateIdx !== -1 && merchantIdx !== -1 && (amountIdx !== -1 || (debitIdx !== -1 && creditIdx !== -1));
  const dataStartLine = headerRecognized ? 1 : 0;

  if (!headerRecognized) {
    // Repli positionnel : colonne 0 = date, 1 = libellé, 2 = montant — ordre
    // le plus courant dans les exports bancaires marocains sans en-tête
    // reconnu. La première ligne est alors traitée comme une donnée, pas un
    // en-tête (sauf si elle échoue à parser, auquel cas on la signale).
    dateIdx = 0;
    merchantIdx = 1;
    amountIdx = 2;
  }

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
