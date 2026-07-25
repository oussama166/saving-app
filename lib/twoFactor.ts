import { generateSecret, generateURI, verify } from 'otplib';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const ISSUER = 'Wealth OS';
// Tolérance de 1 "pas" de 30s de part et d'autre de l'heure actuelle — absorbe
// une petite dérive d'horloge entre le serveur et le téléphone sans pour
// autant élargir la fenêtre de bruteforce de façon significative.
const EPOCH_TOLERANCE_SECONDS = 30;
const RECOVERY_CODE_COUNT = 8;

export function generateTwoFactorSecret(): string {
  return generateSecret();
}

export function buildOtpAuthUri(email: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret });
}

export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  const cleaned = code.trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;
  const result = await verify({ secret, token: cleaned, epochTolerance: EPOCH_TOLERANCE_SECONDS });
  return result.valid;
}

// Codes de récupération format "XXXX-XXXX" (8 caractères alphanumériques,
// lisibles — pas de 0/O/1/I ambigus) — utilisables une seule fois chacun si
// l'utilisateur perd l'accès à son app d'authentification.
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomRecoveryCode(): string {
  const chars = Array.from({ length: 8 }, () => {
    const idx = crypto.randomInt(0, RECOVERY_ALPHABET.length);
    return RECOVERY_ALPHABET[idx];
  });
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, randomRecoveryCode);
}

export async function hashRecoveryCodes(codes: string[]): Promise<string> {
  const hashed = await Promise.all(codes.map((c) => bcrypt.hash(c, 10)));
  return JSON.stringify(hashed);
}

/**
 * Vérifie un code de récupération contre la liste hashée stockée, et — si
 * trouvé — retourne la liste hashée mise à jour SANS ce code (à usage
 * unique, consommé immédiatement). Retourne `null` si le code ne correspond
 * à aucun hash restant.
 */
export async function consumeRecoveryCode(
  code: string,
  hashedCodesJson: string | null,
): Promise<{ remaining: string } | null> {
  if (!hashedCodesJson) return null;
  let hashedCodes: string[];
  try {
    hashedCodes = JSON.parse(hashedCodesJson);
  } catch {
    return null;
  }
  const cleaned = code.trim().toUpperCase();

  for (let i = 0; i < hashedCodes.length; i++) {
    if (await bcrypt.compare(cleaned, hashedCodes[i])) {
      const remaining = [...hashedCodes.slice(0, i), ...hashedCodes.slice(i + 1)];
      return { remaining: JSON.stringify(remaining) };
    }
  }
  return null;
}
