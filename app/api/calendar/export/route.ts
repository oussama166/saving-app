import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getHouseholdContext } from '@/lib/household';
import { requireFeatureAccess } from '@/lib/features';
import { nextOccurrenceDate } from '@/lib/billCalendar';

// Export .ics (iCalendar) de toutes les échéances récurrentes du foyer —
// abonnements, dettes, factures manuelles, versements d'épargne auto,
// virements récurrents — pour les voir dans Google/Apple Calendar avec
// rappels natifs. Un VEVENT récurrent par échéance (RRULE FREQ=MONTHLY),
// pas un fichier généré à la volée par mois : le calendrier du téléphone se
// charge lui-même de répéter l'événement.
//
// Limite connue : RRULE;BYMONTHDAY=29/30/31 saute silencieusement les mois
// plus courts (comportement standard iCalendar, RFC 5545) au lieu de
// "coller" au dernier jour du mois comme le fait dueDateFor() ailleurs dans
// l'app — acceptable pour un export de rappels, pas une source de vérité
// financière.

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function formatIcsDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function formatIcsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

interface IcsEventInput {
  uid: string;
  summary: string;
  dtstart: Date;
  dayOfMonth: number;
}

function buildVEvent({ uid, summary, dtstart, dayOfMonth }: IcsEventInput, stamp: string): string {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@wealthos`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${formatIcsDate(dtstart)}`,
    `RRULE:FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    'END:VEVENT',
  ].join('\r\n');
}

export async function GET() {
  try {
    const { userId } = await requireSession();
    await requireFeatureAccess('calendar', userId);
    const ctx = await getHouseholdContext(userId);

    const [subscriptions, debts, bills, savingsGoals] = await Promise.all([
      prisma.subscription.findMany({ where: { userId: { in: ctx.memberIds }, isActive: true } }),
      prisma.debt.findMany({
        where: { userId: { in: ctx.memberIds }, isActive: true, dueDay: { not: null }, monthlyPayment: { gt: 0 } },
      }),
      prisma.bill.findMany({ where: { userId: { in: ctx.memberIds }, isActive: true } }),
      prisma.savingsGoal.findMany({
        where: { userId: { in: ctx.memberIds }, autoContribute: true, monthlyContribution: { gt: 0 } },
      }),
    ]);

    const now = new Date();
    const stamp = formatIcsStamp(now);
    const vevents: string[] = [];

    for (const sub of subscriptions as { id: string; name: string; price: number; billingDay: number }[]) {
      vevents.push(
        buildVEvent(
          {
            uid: `subscription-${sub.id}`,
            summary: `Abonnement — ${sub.name} (${Math.round(sub.price)} DH)`,
            dtstart: nextOccurrenceDate(sub.billingDay, now),
            dayOfMonth: sub.billingDay,
          },
          stamp,
        ),
      );
    }

    for (const debt of debts as { id: string; name: string; monthlyPayment: number; dueDay: number | null }[]) {
      if (!debt.dueDay) continue;
      vevents.push(
        buildVEvent(
          {
            uid: `debt-${debt.id}`,
            summary: `Dette — ${debt.name} (${Math.round(debt.monthlyPayment)} DH)`,
            dtstart: nextOccurrenceDate(debt.dueDay, now),
            dayOfMonth: debt.dueDay,
          },
          stamp,
        ),
      );
    }

    for (const bill of bills as { id: string; name: string; amount: number; dayOfMonth: number }[]) {
      vevents.push(
        buildVEvent(
          {
            uid: `bill-${bill.id}`,
            summary: `Facture — ${bill.name} (${Math.round(bill.amount)} DH)`,
            dtstart: nextOccurrenceDate(bill.dayOfMonth, now),
            dayOfMonth: bill.dayOfMonth,
          },
          stamp,
        ),
      );
    }

    for (const goal of savingsGoals as { id: string; name: string; monthlyContribution: number; contributionDay: number }[]) {
      vevents.push(
        buildVEvent(
          {
            uid: `savingsGoal-${goal.id}`,
            summary: `Épargne — ${goal.name} (${Math.round(goal.monthlyContribution)} DH)`,
            dtstart: nextOccurrenceDate(goal.contributionDay, now),
            dayOfMonth: goal.contributionDay,
          },
          stamp,
        ),
      );
    }

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Tanger Wealth OS//Calendrier//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:WealthOS — Échéances',
      ...vevents,
      'END:VCALENDAR',
    ].join('\r\n');

    return new Response(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="wealthos-calendrier.ics"',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return new Response('Non authentifié', { status: 401 });
    }
    if (error instanceof Error && error.message === 'FEATURE_DISABLED') {
      return new Response('Fonctionnalité désactivée', { status: 403 });
    }
    console.error('Calendar ICS Export Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
