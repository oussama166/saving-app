import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWeeklyDigestForUser } from "@/lib/weeklyDigest";

export const dynamic = "force-dynamic";

/**
 * Envoie le digest hebdomadaire à tous les utilisateurs (voir
 * lib/weeklyDigest.ts). Même pattern que /api/backup/archive : protégé par
 * un header `x-cron-secret` (pas la session cookie — exclu de la protection
 * middleware, voir middleware.ts), pensé pour être appelé par un job
 * planifié externe (cron-job.org, GitHub Actions...) une fois par semaine,
 * pas depuis le navigateur. Vercel Hobby ne garantit pas de cron interne
 * fiable en continu, d'où ce pattern déjà utilisé pour l'archivage.
 */
export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-cron-secret");
    if (!process.env.WEEKLY_DIGEST_SECRET || secret !== process.env.WEEKLY_DIGEST_SECRET) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

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

    return NextResponse.json({ success: true, totalUsers: users.length, sent, skipped });
  } catch (error) {
    console.error("Weekly Digest Cron Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
