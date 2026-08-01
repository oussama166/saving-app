import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getHouseholdContext } from '@/lib/household';

// Journal Kakeibo du mois en cours (voir prisma/schema.prisma:KakeiboEntry) —
// un seul journal partagé par le foyer, rattaché au propriétaire budget
// comme UserSettings/Category. Toujours le mois EN COURS : pas de navigation
// vers un mois passé pour l'instant (la méthode Kakeibo est pensée comme un
// rituel du début de mois, pas un historique à consulter).
function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function GET() {
  try {
    const { userId } = await requireSession();
    const ctx = await getHouseholdContext(userId);
    const monthKey = currentMonthKey();

    const entry = await prisma.kakeiboEntry.findUnique({
      where: { userId_monthKey: { userId: ctx.budgetOwnerId, monthKey } },
    });

    return NextResponse.json({
      success: true,
      data: {
        monthKey,
        reflection1: entry?.reflection1 ?? '',
        reflection2: entry?.reflection2 ?? '',
        reflection3: entry?.reflection3 ?? '',
        reflection4: entry?.reflection4 ?? '',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Kakeibo GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { userId } = await requireSession();
    const { reflection1, reflection2, reflection3, reflection4 } = (await req.json()) as {
      reflection1?: string;
      reflection2?: string;
      reflection3?: string;
      reflection4?: string;
    };

    const ctx = await getHouseholdContext(userId);
    const monthKey = currentMonthKey();

    await prisma.kakeiboEntry.upsert({
      where: { userId_monthKey: { userId: ctx.budgetOwnerId, monthKey } },
      update: {
        reflection1: reflection1 ?? '',
        reflection2: reflection2 ?? '',
        reflection3: reflection3 ?? '',
        reflection4: reflection4 ?? '',
      },
      create: {
        userId: ctx.budgetOwnerId,
        monthKey,
        reflection1: reflection1 ?? '',
        reflection2: reflection2 ?? '',
        reflection3: reflection3 ?? '',
        reflection4: reflection4 ?? '',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Kakeibo PUT Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
