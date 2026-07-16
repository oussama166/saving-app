import { randomBytes } from 'crypto';

// Séparé de lib/auth.ts pour la même raison que lib/webhookAuth.ts : ce
// dernier est importé par middleware.ts (Edge Runtime), qui ne supporte pas
// le module Node 'crypto'.

export function generateSecureToken(): string {
  return randomBytes(32).toString('hex');
}
