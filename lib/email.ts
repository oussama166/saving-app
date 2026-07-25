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

export async function sendBudgetAlertEmail(
  to: string,
  params: { categoryName: string; threshold: number; spent: number; budget: number; usedPct: number },
): Promise<boolean> {
  const { categoryName, threshold, spent, budget, usedPct } = params;
  const isOver = threshold >= 100;
  const title = isOver ? `Budget dépassé — ${categoryName}` : `Budget bientôt atteint — ${categoryName}`;
  const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} DH`;
  const color = isOver ? '#ef4444' : '#f59e0b';

  return sendEmail({
    to,
    subject: `${title} — Wealth OS`,
    html: wrapEmailHtml(
      title,
      `
        <p style="font-size: 14px; line-height: 1.6;">
          La catégorie <strong>${categoryName}</strong> a atteint
          <strong style="color: ${color};">${Math.round(usedPct)}%</strong> de son budget mensuel.
        </p>
        <p style="font-size: 14px; line-height: 1.6;">
          Dépensé : <strong>${fmt(spent)}</strong> sur un budget de <strong>${fmt(budget)}</strong>.
        </p>
        <p style="margin: 24px 0;">
          <a href="${getSiteUrl()}/saisie" style="background: ${color}; color: white; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 700; display: inline-block;">
            Voir le détail du budget
          </a>
        </p>
        <p style="font-size: 12px; color: #64748b;">Tu ne recevras pas d'autre email pour ce palier ce mois-ci sur cette catégorie.</p>
      `,
    ),
  });
}

export async function sendWeeklyDigestEmail(
  to: string,
  data: {
    weekIncome: number;
    weekExpenses: number;
    topCategories: { name: string; amount: number }[];
    budgetWarnings: { name: string; usedPct: number; spent: number; budget: number }[];
    goalsCount: number;
    goalsProgressPct: number;
    weekGoalContributions: number;
  },
): Promise<boolean> {
  const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} DH`;

  const topCategoriesHtml = data.topCategories.length
    ? `<ul style="padding-left: 18px; margin: 8px 0; font-size: 13px; line-height: 1.8;">
        ${data.topCategories.map((c) => `<li>${c.name} — <strong>${fmt(c.amount)}</strong></li>`).join('')}
      </ul>`
    : `<p style="font-size: 13px; color: #64748b;">Aucune dépense cette semaine.</p>`;

  const warningsHtml = data.budgetWarnings.length
    ? `<ul style="padding-left: 18px; margin: 8px 0; font-size: 13px; line-height: 1.8;">
        ${data.budgetWarnings
          .map(
            (w) =>
              `<li style="color: ${w.usedPct >= 100 ? '#ef4444' : '#f59e0b'};">${w.name} — ${w.usedPct}% (${fmt(w.spent)} / ${fmt(w.budget)})</li>`,
          )
          .join('')}
      </ul>`
    : `<p style="font-size: 13px; color: #10b981;">Tous les budgets sont sous contrôle ce mois-ci. 👍</p>`;

  return sendEmail({
    to,
    subject: 'Ton résumé de la semaine — Wealth OS',
    html: wrapEmailHtml(
      'Ton résumé de la semaine',
      `
        <p style="font-size: 14px; line-height: 1.6;">
          Revenus : <strong>${fmt(data.weekIncome)}</strong> — Dépenses : <strong>${fmt(data.weekExpenses)}</strong>
        </p>

        <h2 style="font-size: 13px; font-weight: 700; margin-top: 20px;">Top dépenses de la semaine</h2>
        ${topCategoriesHtml}

        <h2 style="font-size: 13px; font-weight: 700; margin-top: 20px;">Budgets à surveiller (mois en cours)</h2>
        ${warningsHtml}

        ${
          data.goalsCount > 0
            ? `<h2 style="font-size: 13px; font-weight: 700; margin-top: 20px;">Objectifs d'épargne</h2>
               <p style="font-size: 13px; line-height: 1.6;">
                 ${data.goalsCount} objectif(s) — <strong>${data.goalsProgressPct}%</strong> atteint au total.
                 ${data.weekGoalContributions > 0 ? `Versé cette semaine : <strong>${fmt(data.weekGoalContributions)}</strong>.` : ''}
               </p>`
            : ''
        }

        <p style="margin: 24px 0;">
          <a href="${getSiteUrl()}/" style="background: #2563eb; color: white; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 700; display: inline-block;">
            Ouvrir le dashboard
          </a>
        </p>
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
