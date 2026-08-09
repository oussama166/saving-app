import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDueSubscriptionReminders } from "@/lib/subscriptions";
import { runDueRecurringTransfers } from "@/lib/recurringTransfers";
import { sendWeeklyDigestForUser } from "@/lib/weeklyDigest";

export const dynamic = "force-dynamic";

/**
 * Point d'entrée UNIQUE pour le cron Vercel natif (voir vercel.json), qui
 * regroupe les 3 tâches planifiées quotidiennes de l'app (rappels
 * d'abonnements, virements récurrents, digest hebdomadaire). Nécessaire car
 * le plan Hobby de Vercel limite à 2 cron jobs par projet max, et un
 * seul suffit ici.
 *
 * Remplace le système précédent de 3 routes séparées appelées par un cron
 * externe (cron-job.org) — Vercel appelle CETTE route automatiquement une
 * fois par jour et contourne nativement la Deployment Protection pour ses
 * propres appels cron, donc plus de bypass token ni de service tiers requis.
 *
 * Auth : header `Authorization: Bearer <CRON_SECRET>`, envoyé automatiquement
 * par Vercel quand la variable d'env CRON_SECRET est définie sur le projet
 * (voir https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
 *
 * Les 3 routes /api/cron/weekly-digest, /api/cron/subscription-reminders et
 * /api/cron/recurring-transfers restent disponibles séparément (avec leurs
 * secrets `x-*-secret` existants) pour un redéclenchement manuel ponctuel si
 * besoin — cette route-ci est la seule à être réellement planifiée.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  try {
    results.subscriptionReminders = await sendDueSubscriptionReminders();
  } catch (error) {
    console.error("Daily Cron — subscriptionReminders a échoué:", error);
    results.subscriptionReminders = { error: "failed" };
  }

  try {
    results.recurringTransfers = await runDueRecurringTransfers();
  } catch (error) {
    console.error("Daily Cron — recurringTransfers a échoué:", error);
    results.recurringTransfers = { error: "failed" };
  }

  // Digest hebdomadaire : seulement le lundi, même si cette route tourne
  // tous les jours (voir lib/weeklyDigest.ts, historiquement pensé pour un
  // cron externe hebdomadaire dédié).
  // ⚠️ TEMPORAIRE — forcé à true pour tester le digest hors lundi. À remettre
  // à `new Date().getUTCDay() === 1` juste après le test.
  const isMonday = true;
  if (isMonday) {
    try {
      const users = await prisma.user.findMany({
        where: { isSuspended: false, emailVerified: true },
        select: { id: true, email: true },
      });
      let sent = 0;
      let skipped = 0;
      for (const user of users) {
        const ok = await sendWeeklyDigestForUser(user.id, user.email);
        if (ok) sent += 1;
        else skipped += 1;
      }
      results.weeklyDigest = { totalUsers: users.length, sent, skipped };
    } catch (error) {
      console.error("Daily Cron — weeklyDigest a échoué:", error);
      results.weeklyDigest = { error: "failed" };
    }
  } else {
    results.weeklyDigest = { skipped: "pas lundi" };
  }

  return NextResponse.json({ success: true, ...results });
}
