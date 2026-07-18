import { prisma } from '@/lib/prisma';

// Journal d'audit minimal pour toute action admin sensible (suspension,
// suppression, reset password déclenché, création d'un autre admin...).
// Volontairement "fire and forget" côté appelant : un échec d'écriture du
// log ne doit jamais faire échouer l'action elle-même (ex: si la table
// AdminAuditLog a un souci, la suspension d'un utilisateur doit quand même
// aboutir) — les erreurs sont juste loguées côté serveur.
export async function logAdminAction(params: {
  adminId: string;
  adminEmail: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId: params.adminId,
        adminEmail: params.adminEmail,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        details: params.details ? JSON.stringify(params.details) : null,
      },
    });
  } catch (error) {
    console.error('Admin audit log write failed:', error);
  }
}
