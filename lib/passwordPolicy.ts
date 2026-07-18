// Règle de mot de passe fort partagée entre scripts/create-admin.ts (CLI) et
// POST /api/admin/admins (création d'un admin depuis l'UI) — un seul
// endroit à faire évoluer si la politique change. Volontairement séparé de
// lib/auth.ts pour rester importable depuis un script tsx exécuté hors
// Next.js (import relatif dans scripts/create-admin.ts).
export const PASSWORD_MIN_LENGTH = 12;

export function validatePasswordStrength(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  if (!/[a-z]/.test(password)) return 'Le mot de passe doit contenir au moins une minuscule.';
  if (!/[A-Z]/.test(password)) return 'Le mot de passe doit contenir au moins une majuscule.';
  if (!/[0-9]/.test(password)) return 'Le mot de passe doit contenir au moins un chiffre.';
  if (!/[^a-zA-Z0-9]/.test(password)) return 'Le mot de passe doit contenir au moins un caractère spécial.';
  return null;
}
