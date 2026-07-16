// Envoi d'emails transactionnels (vérification de compte, réinitialisation
// de mot de passe) via l'API Resend — gratuit jusqu'à 3000 emails/mois, pas
// de carte bancaire requise (inscription sur https://resend.com/). Appelle
// directement l'API REST plutôt que le SDK npm, pour rester cohérent avec
// le reste du projet (voir lib/placeCategory.ts) et éviter une dépendance
// supplémentaire.
//
// Dégradation propre si RESEND_API_KEY n'est pas configuré : on log un
// warning et on renvoie false, sans jamais faire planter le flux appelant
// (signup/login doivent réussir même si l'email ne part pas).

const RESEND_URL = 'https://api.resend.com/emails';
const FETCH_TIMEOUT_MS = 8000;

// Expéditeur par défaut : le domaine de test Resend, utilisable sans
// vérification de domaine — pratique pour démarrer. Une fois un domaine
// vérifié sur resend.com, définir EMAIL_FROM dans .env (ex:
// "WealthOS <no-reply@tondomaine.com>") pour l'utiliser à la place.
const DEFAULT_FROM = 'WealthOS <onboarding@resend.dev>';

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

async function sendEmail(params: { to: string; subject: string; html: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`email: RESEND_API_KEY manquant dans .env — email "${params.subject}" à ${params.to} non envoyé.`);
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || DEFAULT_FROM,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`email: Resend a répondu ${res.status} pour "${params.subject}" à ${params.to} — ${body}`);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('email: erreur pendant l\'envoi via Resend —', err instanceof Error ? err.message : err);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function wrapEmailHtml(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1b253b;">
      <h1 style="font-size: 20px; font-weight: 800; margin-bottom: 16px;">${title}</h1>
      ${bodyHtml}
      <p style="margin-top: 32px; font-size: 12px; color: #94a3b8;">Wealth OS — gestion de patrimoine personnelle</p>
    </div>
  `;
}

export async function sendVerificationEmail(to: string, token: string): Promise<boolean> {
  const link = `${getSiteUrl()}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  return sendEmail({
    to,
    subject: 'Confirme ton adresse email — Wealth OS',
    html: wrapEmailHtml(
      'Confirme ton adresse email',
      `
        <p style="font-size: 14px; line-height: 1.6;">
          Merci de t'être inscrit sur Wealth OS. Clique sur le bouton ci-dessous pour confirmer ton adresse email :
        </p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="background: #2563eb; color: white; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 700; display: inline-block;">
            Confirmer mon email
          </a>
        </p>
        <p style="font-size: 12px; color: #64748b;">Ce lien expire dans 24 heures. Si tu n'es pas à l'origine de cette inscription, ignore cet email.</p>
      `,
    ),
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
  const link = `${getSiteUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  return sendEmail({
    to,
    subject: 'Réinitialisation de ton mot de passe — Wealth OS',
    html: wrapEmailHtml(
      'Réinitialiser ton mot de passe',
      `
        <p style="font-size: 14px; line-height: 1.6;">
          Une demande de réinitialisation de mot de passe a été faite pour ce compte. Clique sur le bouton ci-dessous pour choisir un nouveau mot de passe :
        </p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="background: #2563eb; color: white; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 700; display: inline-block;">
            Réinitialiser mon mot de passe
          </a>
        </p>
        <p style="font-size: 12px; color: #64748b;">Ce lien expire dans 1 heure. Si tu n'es pas à l'origine de cette demande, ignore cet email — ton mot de passe reste inchangé.</p>
      `,
    ),
  });
}
