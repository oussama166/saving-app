import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession, ADMIN_SESSION_COOKIE } from '@/lib/adminAuth';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }

    const admin = await prisma.admin.findUnique({ where: { id: session.adminId } });
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }

    // Admin désactivé par un autre admin depuis la création de ce token :
    // coupe la session ici (mirroring la logique de suspension utilisateur
    // dans /api/auth/me), même si le JWT reste cryptographiquement valide
    // jusqu'à son expiration (4h).
    if (!admin.isActive) {
      const response = NextResponse.json({ success: false, error: 'Ce compte admin a été désactivé.' }, { status: 403 });
      response.cookies.set(ADMIN_SESSION_COOKIE, '', { path: '/', maxAge: 0 });
      return response;
    }

    return NextResponse.json({
      success: true,
      admin: { id: admin.id, email: admin.email, name: admin.name },
    });
  } catch (error) {
    console.error('Admin Me Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
