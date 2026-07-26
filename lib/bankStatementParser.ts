// Nettoyage + enrichissement d'une ligne brute de relevé bancaire marocain
// (format BMCE/BCP observé en pratique via l'import CSV — voir
// app/api/transactions/import-csv/route.ts). Une ligne brute typique est
// pleine de bruit ("PAIEMENT PAR CARTE 477910******240* LE 29/06/2026 MCDO
// KIT ZENATA B2P MCC 5814") qui, non traité, se retrouve tel quel comme
// libellé de transaction et ne donne aucun signal de méthode de paiement ni
// de catégorie fiable. Ce module extrait :
//  - une description nettoyée (sans le numéro de carte masqué, la date de
//    l'opération déjà présente par ailleurs, ni le code MCC brut) ;
//  - la méthode de paiement (une des valeurs déjà utilisées par
//    TransactionForm.tsx : "Carte Bancaire", "Espèces", "BMCE DIRECT",
//    "Virement Bancaire"...) ;
//  - le code MCC (Merchant Category Code) s'il est présent, pour la
//    catégorisation (voir MCC_TO_CATEGORY plus bas) ;
//  - éventuellement une catégorie déjà tranchée quand la ligne est une
//    opération bancaire administrative (commission, agios, virement...) où
//    deviner à partir du "nom du marchand" n'aurait pas de sens.
//
// Reste conservateur : si aucun motif connu ne matche, on renvoie la ligne
// telle quelle (juste trim), sans méthode ni catégorie — mieux vaut ne rien
// deviner que de tronquer à tort un format qu'on ne reconnaît pas.

export interface BankLineParseResult {
  cleanDescription: string;
  paymentMethod: string | null;
  mcc: string | null;
  categoryHint: { categoryName: string; subCategoryName?: string } | null;
}

const DATE_RE = String.raw`\d{2}/\d{2}/\d{4}`;
const MCC_SUFFIX_RE = /\s+MCC\s+(\d{3,4})\s*$/i;

// Retire un éventuel suffixe " MCC ####" de fin de chaîne et renvoie le
// reste (trim) + le code s'il était présent.
function stripMcc(text: string): { rest: string; mcc: string | null } {
  const m = text.match(MCC_SUFFIX_RE);
  if (!m) return { rest: text.trim(), mcc: null };
  return { rest: text.slice(0, m.index).trim(), mcc: m[1] };
}

// "BMCE Direct vers X" imbriqué dans une ligne de commission/TVA — on essaie
// d'extraire juste le destinataire pour un libellé plus court et lisible.
function simplifyNestedTransferLabel(text: string): string {
  const m = text.trim().match(/^BMCE\s+Direct\s+vers\s+(.+)$/i);
  return m ? m[1].trim() : text.trim();
}

// Une ligne "EPAIEMENT FACT ddmmyy <fournisseur> <identifiants numériques...>"
// — on garde le nom du fournisseur et on retire les longs identifiants
// numériques (n° de compte/téléphone) qui ne sont pas lisibles.
function cleanBillProvider(text: string): string {
  const tokens = text.trim().split(/\s+/);
  while (tokens.length > 1 && /^\d{6,}$/.test(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(' ');
}

const TELECOM_PROVIDER_KEYWORDS = ['inwi', 'iam', 'orange', 'wana', 'maroc telecom', 'maroctelecom'];

function isTelecomProvider(providerLabel: string): boolean {
  const normalized = providerLabel.toLowerCase();
  return TELECOM_PROVIDER_KEYWORDS.some((kw) => normalized.includes(kw));
}

const DIVERS_FRAIS = { categoryName: 'Divers & Imprévus', subCategoryName: 'Imprévus divers' };
const TELECOM = { categoryName: 'Logement & Charges', subCategoryName: 'Internet & Téléphone' };
// Virement BMCE Direct vers un tiers — le destinataire ne dit rien sur la
// raison (famille, remboursement, loyer...), mais l'opération est bien un
// virement bancaire, donc catégorisée comme telle plutôt que laissée
// Uncategorized (sur demande explicite — voir historique de la conversation).
const VIREMENT_BANCAIRE = { categoryName: 'Divers & Imprévus', subCategoryName: 'Virement Bancaire' };

/**
 * Parse une ligne brute de relevé bancaire (le "libellé"/"description" tel
 * qu'exporté par la banque) — reconnaît les formats BMCE/BCP les plus
 * courants (paiement carte, retrait GAB, virement BMCE Direct, commissions,
 * agios, épaiement de facture). Renvoie toujours une description exploitable
 * (au pire, la ligne brute trimée si aucun motif ne matche).
 */
export function parseBankStatementLine(raw: string): BankLineParseResult {
  const line = raw.trim();

  // 1. Paiement par carte (domestique ou international).
  let m = line.match(new RegExp(`^PAIEMENT(?:\\s+INTERNATIONAL)?\\s+PAR\\s+CARTE\\s+\\S+\\s+LE\\s+${DATE_RE}\\s+(.+)$`, 'i'));
  if (m) {
    const { rest, mcc } = stripMcc(m[1]);
    return { cleanDescription: rest, paymentMethod: 'Carte Bancaire', mcc, categoryHint: null };
  }

  // 2. Retrait GAB (cash, via carte) — méthode = Espèces (c'est du liquide
  //    retiré, pas une dépense carte), destination du cash inconnue.
  m = line.match(new RegExp(`^RETRAIT\\s+GAB\\s+CONFRERE\\s+CARTE\\s+\\S+\\s+LE\\s+${DATE_RE}\\s+(.+)$`, 'i'));
  if (m) {
    const { rest, mcc } = stripMcc(m[1]);
    return {
      cleanDescription: `Retrait GAB — ${rest}`,
      paymentMethod: 'Espèces',
      mcc,
      categoryHint: DIVERS_FRAIS,
    };
  }

  // 3. Commission sur retrait GAB.
  m = line.match(new RegExp(`^COMMISSION\\s+RETRAIT\\s+GAB\\s+CONFRERE\\s+DU\\s+${DATE_RE}\\s+(.+)$`, 'i'));
  if (m) {
    return {
      cleanDescription: `Commission retrait GAB — ${m[1].trim()}`,
      paymentMethod: null,
      mcc: null,
      categoryHint: DIVERS_FRAIS,
    };
  }

  // 4. Virement BMCE Direct vers un tiers — le destinataire final (famille ?
  //    remboursement ? loyer ?) reste inconnu, mais l'opération elle-même
  //    est un virement bancaire : catégorisée comme telle plutôt que laissée
  //    Uncategorized.
  m = line.match(/^BMCE\s+Direct\s+vers\s+(.+)$/i);
  if (m) {
    return {
      cleanDescription: `Virement BMCE Direct — ${m[1].trim()}`,
      paymentMethod: 'BMCE DIRECT',
      mcc: null,
      categoryHint: VIREMENT_BANCAIRE,
    };
  }

  // 5. Commission sur virement vers confrère.
  m = line.match(/^COMMISSION\s+SUR\s+LE\(S\)\s+VIREMENT\s+VERS\s+CONFRERE\s+LIBELLE\s*:\s*(.+)$/i);
  if (m) {
    return {
      cleanDescription: `Commission virement — ${simplifyNestedTransferLabel(m[1])}`,
      paymentMethod: 'BMCE DIRECT',
      mcc: null,
      categoryHint: DIVERS_FRAIS,
    };
  }

  // 6. TVA sur commission de virement.
  m = line.match(/^TVA\s+SUR\s+COMMISSION\s+ET\s+FPL\s+DU\s+VIREMENT\s+LIBELLE\s*:\s*(.+)$/i);
  if (m) {
    return {
      cleanDescription: `TVA commission virement — ${simplifyNestedTransferLabel(m[1])}`,
      paymentMethod: 'BMCE DIRECT',
      mcc: null,
      categoryHint: DIVERS_FRAIS,
    };
  }

  // 7. Épaiement de facture (recharge téléphonique, factures diverses...).
  m = line.match(/^EPAIEMENT\s+FACT\s+\d{6}\s+(.+)$/i);
  if (m) {
    const provider = cleanBillProvider(m[1]);
    return {
      cleanDescription: `Facture — ${provider}`,
      paymentMethod: 'Virement Bancaire',
      mcc: null,
      categoryHint: isTelecomProvider(provider) ? TELECOM : null,
    };
  }

  // 8. Agios (intérêts débiteurs) — ligne quasi toujours seule ("AGIOS").
  if (/^AGIOS$/i.test(line)) {
    return {
      cleanDescription: 'Agios (intérêts débiteurs)',
      paymentMethod: null,
      mcc: null,
      categoryHint: DIVERS_FRAIS,
    };
  }

  // Format non reconnu : on ne tronque ni ne devine rien, mieux vaut garder
  // la ligne brute (trimée) que de mal la découper.
  return { cleanDescription: line, paymentMethod: null, mcc: null, categoryHint: null };
}

// Codes MCC (Merchant Category Code, norme ISO 18245) rencontrés dans des
// relevés marocains + un socle de codes courants — sert de 2e signal de
// catégorisation quand le nom du marchand seul (voir
// lib/placeCategory.ts::guessCategoryFromMerchantName) ne matche aucun
// mot-clé connu. Un MCC est fourni par la banque de manière fiable pour tout
// paiement carte, contrairement au nom du marchand qui varie énormément
// (raisons sociales, terminaux, abréviations).
export const MCC_TO_CATEGORY: Record<string, { categoryName: string; subCategoryName?: string }> = {
  '5811': { categoryName: 'Alimentation & Restauration', subCategoryName: 'Restaurant' },
  '5812': { categoryName: 'Alimentation & Restauration', subCategoryName: 'Restaurant' },
  '5813': { categoryName: 'Alimentation & Restauration', subCategoryName: 'Restaurant' },
  '5814': { categoryName: 'Alimentation & Restauration', subCategoryName: 'Café / Fast-food' },
  '5462': { categoryName: 'Alimentation & Restauration', subCategoryName: 'Épicerie/Courses' },
  '5411': { categoryName: 'Alimentation & Restauration', subCategoryName: 'Épicerie/Courses' },
  '5499': { categoryName: 'Alimentation & Restauration', subCategoryName: 'Épicerie/Courses' },
  '5912': { categoryName: 'Santé & Médical', subCategoryName: 'Pharmacie/Médicaments' },
  '8011': { categoryName: 'Santé & Médical', subCategoryName: 'Médecin Généraliste' },
  '8021': { categoryName: 'Santé & Médical', subCategoryName: 'Dentiste' },
  '8071': { categoryName: 'Santé & Médical', subCategoryName: 'Analyses/Labo' },
  '5541': { categoryName: 'Transport & Mobilité', subCategoryName: 'Carburant' },
  '5542': { categoryName: 'Transport & Mobilité', subCategoryName: 'Carburant' },
  '4121': { categoryName: 'Transport & Mobilité', subCategoryName: 'Taxi/Uber' },
  '4111': { categoryName: 'Transport & Mobilité', subCategoryName: 'Transport en commun' },
  '4112': { categoryName: 'Transport & Mobilité', subCategoryName: 'Transport en commun' },
  '7523': { categoryName: 'Transport & Mobilité', subCategoryName: 'Entretien Véhicule' },
  '7531': { categoryName: 'Transport & Mobilité', subCategoryName: 'Entretien Véhicule' },
  '6011': { categoryName: 'Divers & Imprévus', subCategoryName: 'Imprévus divers' }, // retrait GAB (déjà géré par parseBankStatementLine, gardé en filet de sécurité)
  '4899': { categoryName: 'Tech & Abonnements', subCategoryName: 'Netflix/Disney+' }, // TV payante/streaming
  '5815': { categoryName: 'Tech & Abonnements', subCategoryName: 'Applications/Logiciels' }, // biens numériques : médias
  '5816': { categoryName: 'Tech & Abonnements', subCategoryName: 'Applications/Logiciels' }, // biens numériques : jeux
  '5817': { categoryName: 'Tech & Abonnements', subCategoryName: 'Applications/Logiciels' }, // biens numériques : applications
  '5818': { categoryName: 'Tech & Abonnements', subCategoryName: 'Applications/Logiciels' }, // biens numériques : gros marchands (Apple...)
  '5734': { categoryName: 'Tech & Abonnements', subCategoryName: 'Applications/Logiciels' }, // éditeurs de logiciels
  '5732': { categoryName: 'Tech & Abonnements', subCategoryName: 'Matériel Informatique' },
  '4814': { categoryName: 'Logement & Charges', subCategoryName: 'Internet & Téléphone' },
  '4816': { categoryName: 'Logement & Charges', subCategoryName: 'Internet & Téléphone' },
  '4900': { categoryName: 'Logement & Charges', subCategoryName: 'Eau & Électricité' },
  '7997': { categoryName: 'Loisirs & Divertissement', subCategoryName: 'Sport & Fitness' },
  '7941': { categoryName: 'Loisirs & Divertissement', subCategoryName: 'Sport & Fitness' },
  '7832': { categoryName: 'Loisirs & Divertissement', subCategoryName: 'Cinéma/Sorties' },
  '7011': { categoryName: 'Loisirs & Divertissement', subCategoryName: 'Voyages courts' },
  '4511': { categoryName: 'Loisirs & Divertissement', subCategoryName: 'Voyages courts' },
  '5651': { categoryName: 'Shopping & Vêtements', subCategoryName: 'Vêtements & Chaussures' },
  '5691': { categoryName: 'Shopping & Vêtements', subCategoryName: 'Vêtements & Chaussures' },
  '5311': { categoryName: 'Shopping & Vêtements' },
  '5722': { categoryName: 'Shopping & Vêtements', subCategoryName: 'Électroménager' },
};

/**
 * Devine une catégorie à partir du seul code MCC — utilisé en repli quand le
 * nom du marchand (guessCategoryFromMerchantName) ne matche aucun mot-clé
 * connu. Le nom du marchand reste prioritaire côté appelant : un mot-clé
 * explicite ("glovo" par ex., classé MCC 4789 "transport" par les
 * banques alors qu'il s'agit en pratique de livraison de repas au Maroc) est
 * un signal plus fiable que le MCC générique.
 */
export function guessCategoryFromMcc(mcc: string | null): { categoryName: string; subCategoryName?: string } | null {
  if (!mcc) return null;
  return MCC_TO_CATEGORY[mcc] ?? null;
}
