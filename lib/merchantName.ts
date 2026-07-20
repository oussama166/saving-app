// Nettoie un nom de marchand tel qu'il arrive brut d'une notification/SMS
// bancaire — préfixes/suffixes de type domaine ou code de référence court —
// avant de le comparer aux abonnements enregistrés dans
// /api/webhook/subscription-payment. Exemples réels :
//   "startselect.help" -> "startselect"
//   "www.netflix.com"  -> "netflix"
//   "Glovo_pz"         -> "Glovo"
//
// Heuristique volontairement simple (regex, pas de résolution DNS ni de
// dépendance externe) : suffisant pour améliorer le matching tolérant déjà
// en place, pas une normalisation universelle. Certains cas limites peuvent
// sur-nettoyer un nom légitime (voir commentaire sur le suffixe court
// ci-dessous) — acceptable pour cet usage, ajustable si un cas concret pose
// problème.

const WWW_PREFIX_RE = /^www\./i;

// Suffixe de domaine — un seul niveau (".help", ".com"...), appliqué avant
// le nettoyage des codes courts pour ne pas couper un TLD par erreur.
const DOMAIN_SUFFIX_RE =
  /\.(com|net|org|io|co|app|shop|store|info|biz|help|me|ma)$/i;

// Code de référence court collé après un underscore en fin de chaîne (ex:
// "_pz", "_01"). Volontairement limité à l'underscore (pas le tiret) : un
// tiret fait plus souvent partie d'un nom légitime ("Uber-Eats", "T-Mobile")
// alors qu'un underscore suivi de 1-4 caractères ressemble presque toujours
// à un code pays/référence ajouté par un processeur de paiement.
const SHORT_CODE_SUFFIX_RE = /_[a-z0-9]{1,4}$/i;

export function normalizeMerchantName(raw: string): string {
  let name = raw.trim();
  name = name.replace(WWW_PREFIX_RE, "");
  name = name.replace(DOMAIN_SUFFIX_RE, "");
  name = name.replace(SHORT_CODE_SUFFIX_RE, "");
  return name.trim();
}
