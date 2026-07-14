import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

const VALID_STATUSES = new Set(['PENDING', 'SUBMITTED', 'REIMBURSED']);

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;
    const { reimbursementStatus } = await req.json();

    if (!VALID_STATUSES.has(reimbursementStatus)) {
      return NextResponse.json({ success: false, error: 'Statut invalide' }, { status: 400 });
    }

    const existing = await prisma.medicalRecord.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Dossier introuvable' }, { status: 404 });
    }

    const record = await prisma.medicalRecord.update({
      where: { id },
      data: { reimbursementStatus },
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Health PUT Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireSession();
    const { id } = await params;

    const existing = await prisma.medicalRecord.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Dossier introuvable' }, { status: 404 });
    }

    await prisma.medicalRecord.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Health DELETE Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
