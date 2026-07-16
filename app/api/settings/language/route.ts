import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { isLocale } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/**
 * Route dédiée (plutôt que d'étendre PUT /api/settings) pour permettre un
 * changement de langue instantané depuis le sélecteur, sans devoir fournir
 * referenceIncome/allocations à chaque fois.
 */
export async function PUT(req: Request) {
  try {
    const { userId } = await requireSession();
    const { language } = (await req.json()) as { language?: string };

    if (!isLocale(language)) {
      return NextResponse.json({ success: false, error: 'Langue invalide' }, { status: 400 });
    }

    await prisma.userSettings.upsert({
      where: { userId },
      update: { language },
      create: { userId, language },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Language PUT Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
