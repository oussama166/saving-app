"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ScrollText, ChevronLeft, ChevronRight, Loader2, User, ShieldCheck } from "lucide-react";

interface AuditLog {
  id: string;
  adminEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: string | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  "user.suspend": "Suspension d'utilisateur",
  "user.reactivate": "Réactivation d'utilisateur",
  "user.delete": "Suppression d'utilisateur",
  "user.resend_verification": "Renvoi email de vérification",
  "user.reset_password": "Réinitialisation mot de passe déclenchée",
  "user.update_settings": "Modification des paramètres",
  "admin.create": "Création d'un admin",
  "admin.activate": "Réactivation d'un admin",
  "admin.deactivate": "Désactivation d'un admin",
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

function actionColor(action: string) {
  if (action.includes("delete") || action.includes("deactivate")) return "text-red-300 bg-red-500/10 border-red-500/20";
  if (action.includes("suspend")) return "text-orange-300 bg-orange-500/10 border-orange-500/20";
  if (action.includes("create") || action.includes("reactivate") || action.includes("activate")) return "text-emerald-300 bg-emerald-500/10 border-emerald-500/20";
  return "text-blue-300 bg-blue-500/10 border-blue-500/20";
}

export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((pageNum: number) => {
    return fetch(`/api/admin/audit-log?page=${pageNum}`)
      .then((res) => res.json())
      .then((result) => {
        if (!result.success) {
          setError(result.error || "Erreur de chargement");
          return;
        }
        setError(null);
        setLogs(result.data);
        setTotalPages(result.pagination.totalPages);
        setTotal(result.pagination.total);
      })
      .catch(() => setError("Erreur réseau"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(page);
  }, [load, page]);

  return (
    <main className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 text-ink">
      <header>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
          <ScrollText className="w-6 h-6 text-amber-400" />
          Journal d&apos;audit
        </h1>
        <p className="text-subtle text-sm mt-1">{total} action{total === 1 ? "" : "s"} enregistrée{total === 1 ? "" : "s"}.</p>
      </header>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[13px]">{error}</div>
      )}

      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        {loading ? (
          <div className="px-4 py-10 text-center text-faint">
            <Loader2 className="w-5 h-5 animate-spin inline-block" />
          </div>
        ) : logs.length === 0 ? (
          <div className="px-4 py-10 text-center text-faint">Aucune action enregistrée.</div>
        ) : (
          <div className="divide-y divide-line-subtle">
            {logs.map((log) => {
              let parsedDetails: Record<string, unknown> | null = null;
              try {
                parsedDetails = log.details ? JSON.parse(log.details) : null;
              } catch {
                parsedDetails = null;
              }
              return (
                <div key={log.id} className="px-4 py-3 flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${actionColor(log.action)}`}>
                      {actionLabel(log.action)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[13px] text-body-soft">
                        <ShieldCheck className="w-3 h-3 text-amber-400/70 shrink-0" />
                        {log.adminEmail}
                        {log.targetType === "User" && parsedDetails?.email ? (
                          <>
                            <span className="text-faint">→</span>
                            <User className="w-3 h-3 text-faint shrink-0" />
                            {log.targetId ? (
                              <Link href={`/admin/users/${log.targetId}`} className="hover:text-amber-400 truncate">
                                {String(parsedDetails.email)}
                              </Link>
                            ) : (
                              <span className="truncate">{String(parsedDetails.email)}</span>
                            )}
                          </>
                        ) : null}
                      </div>
                      {parsedDetails?.reason ? (
                        <p className="text-[12px] text-faint mt-0.5">Raison : {String(parsedDetails.reason)}</p>
                      ) : null}
                    </div>
                  </div>
                  <span className="text-[12px] text-faint shrink-0">
                    {new Date(log.createdAt).toLocaleString("fr-FR")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => {
              setLoading(true);
              setPage((p) => Math.max(1, p - 1));
            }}
            disabled={page <= 1}
            className="p-2 rounded-lg bg-surface border border-line text-muted hover:text-ink disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[13px] text-subtle">Page {page} / {totalPages}</span>
          <button
            onClick={() => {
              setLoading(true);
              setPage((p) => Math.min(totalPages, p + 1));
            }}
            disabled={page >= totalPages}
            className="p-2 rounded-lg bg-surface border border-line text-muted hover:text-ink disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </main>
  );
}
