import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { validatePasswordStrength } from '@/lib/passwordPolicy';
import { logAdminAction } from '@/lib/adminAudit';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  try {
    await requireAdminSession();

    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, name: true, isActive: true, createdAt: true },
    });

    return NextResponse.json({ success: true, data: admins });
  } catch (error) {
    if (error instanceof Error && error.message === 'ADMIN_UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Admin Admins List Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

// Créer un nouvel admin depuis le panel (le tout premier reste bootstrapé
// via scripts/create-admin.ts, voir ce fichier). Même politique de mot de
// passe fort que le script CLI (lib/passwordPolicy.ts). Le mot de passe
// transite ici en clair sur la requête HTTPS authentifiée — acceptable
// puisque seul un admin déjà connecté peut atteindre cette route (voir
// middleware.ts), mais reste moins isolé que la saisie locale du script.
export async function POST(req: Request) {
  try {
    const admin = await requireAdminSession();
    const { email, name, password } = (await req.json()) as { email?: string; name?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email et mot de passe requis' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return NextResponse.json({ success: false, error: 'Adresse email invalide' }, { status: 400 });
    }

    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      return NextResponse.json({ success: false, error: strengthError }, { status: 400 });
    }

    const existing = await prisma.admin.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ success: false, error: 'Un admin existe déjà avec cet email' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const created = await prisma.admin.create({
      data: { email: normalizedEmail, name: name?.trim() || null, passwordHash },
      select: { id: true, email: true, name: true, isActive: true, createdAt: true },
    });

    await logAdminAction({
      adminId: admin.adminId,
      adminEmail: admin.email,
      action: 'admin.create',
      targetType: 'Admin',
      targetId: created.id,
      details: { email: created.email },
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    if (error instanceof Error && error.message === 'ADMIN_UNAUTHENTICATED') {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Admin Admins Create Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
