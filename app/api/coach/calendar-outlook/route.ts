import { NextResponse } from 'next/server';
import { streamCoachAdvice } from '@/lib/coachHandler';
import { calendarOutlookSchema } from '@/lib/coachSchemas';
import { requireSession } from '@/lib/auth';
import { requireFeatureAccess } from '@/lib/features';
import { getUserLocale } from '@/lib/getLocale';
import { aiLanguageInstruction } from '@/lib/i18n';

const CACHE_KEY = 'calendar-outlook';

interface UpcomingEvent {
  name: string;
  amountMad: number;
  dueDate: string; // ISO
  sourceType: string;
}

interface DailyBudgetPoint {
  date: string; // ISO
  safeDailySpendMad: number;
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireSession();
    // Cette route vit exclusivement dans la page Calendrier (app/calendrier)
    // — gardée par la fonctionnalité 'calendar', pas 'coach' (le calendrier a
    // son propre feature flag indépendant du reste du Coach IA).
    await requireFeatureAccess('calendar', userId);
    const locale = await getUserLocale(userId);
    const {
      startBalanceMad,
      committedOutflowMad,
      safeDailySpendMad,
      daysRemaining,
      nextPayday,
      minProjectedBalanceMad,
      upcomingEvents,
      dailySeries,
      todaySpentMad,
      force,
    } = (await req.json()) as {
      startBalanceMad: number;
      committedOutflowMad: number;
      safeDailySpendMad: number;
      daysRemaining: number;
      nextPayday: string;
      minProjectedBalanceMad: number;
      upcomingEvents: UpcomingEvent[];
      dailySeries?: DailyBudgetPoint[];
      todaySpentMad?: number;
      force?: boolean;
    };

    if (
      typeof startBalanceMad !== 'number' ||
      typeof committedOutflowMad !== 'number' ||
      typeof safeDailySpendMad !== 'number' ||
      typeof daysRemaining !== 'number' ||
      !nextPayday
    ) {
      return NextResponse.json({ success: false, error: 'Données de projection invalides' }, { status: 400 });
    }

    const systemPrompt = `Tu es un conseiller financier basé à Tanger, Maroc, spécialisé en gestion de trésorerie court terme. Style: ultra concis, chiffré, jamais générique. Les chiffres (solde, budget journalier, échéances) sont déjà calculés — tu ne fais que les commenter, jamais les recalculer. ${aiLanguageInstruction(locale)}`;

    const eventsLines = (upcomingEvents ?? [])
      .map((e) => `- ${e.name} (${e.sourceType}): ${Math.round(e.amountMad)} DH le ${e.dueDate.slice(0, 10)}`)
      .join('\n') || '- Aucune échéance connue restante avant la paie.';

    // Le scénario jour par jour (lib/billCalendar.ts) recalcule le budget
    // sécuritaire à chaque jour — on repère ici le jour le plus serré pour
    // que l'IA le cite précisément dans "pointAttention" plutôt que de
    // rester générique.
    const series = (dailySeries ?? []).filter((p) => typeof p.safeDailySpendMad === 'number');
    const tightestDay = series.length
      ? series.reduce((min, p) => (p.safeDailySpendMad < min.safeDailySpendMad ? p : min))
      : null;
    const seriesLines = series
      .map((p) => `- ${p.date.slice(0, 10)}: ${Math.round(p.safeDailySpendMad)} DH/jour`)
      .join('\n') || '- Non disponible.';

    const userPrompt = `Situation de trésorerie jusqu'à la prochaine paie (${nextPayday.slice(0, 10)}, dans ${daysRemaining} jour(s)) :
- Solde actuel du foyer : ${Math.round(startBalanceMad)} DH
- Total des échéances connues non payées d'ici la paie : ${Math.round(committedOutflowMad)} DH
- Solde le plus bas projeté sur la période : ${Math.round(minProjectedBalanceMad)} DH
- Budget journalier sécuritaire aujourd'hui (dépenses libres, hors échéances déjà comptées) : ${Math.round(safeDailySpendMad)} DH/jour
${typeof todaySpentMad === 'number' ? `- Déjà dépensé aujourd'hui (hors échéances) : ${Math.round(todaySpentMad)} DH` : ''}
${tightestDay ? `- Jour le plus serré du scénario : ${tightestDay.date.slice(0, 10)} avec seulement ${Math.round(tightestDay.safeDailySpendMad)} DH/jour disponibles` : ''}

Scénario budget sécuritaire jour par jour (recalculé chaque jour selon les échéances restantes) :
${seriesLines}

Échéances restantes :
${eventsLines}

Donne une synthèse rapide de la situation, le jour précis le plus à risque du scénario ci-dessus (cite sa date et son montant), et une recommandation concrète pour tenir jusqu'à la paie, chacun en une phrase courte.`;

    return await streamCoachAdvice({
      userId,
      locale,
      baseCacheKey: CACHE_KEY,
      input: {
        startBalanceMad,
        committedOutflowMad,
        safeDailySpendMad,
        daysRemaining,
        nextPayday,
        minProjectedBalanceMad,
        upcomingEvents,
        dailySeries,
        todaySpentMad,
      },
      schema: calendarOutlookSchema,
      system: systemPrompt,
      prompt: userPrompt,
      force,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'FEATURE_DISABLED') {
      return NextResponse.json({ success: false, error: 'Cette fonctionnalité est temporairement désactivée.' }, { status: 403 });
    }
    console.error('Calendar Outlook Coach Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
