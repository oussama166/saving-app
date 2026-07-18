"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, ShieldBan, ShieldCheck, ChevronLeft, ChevronRight, Loader2, Download } from "lucide-react";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  isSuspended: boolean;
  suspendedAt: string | null;
  createdAt: string;
  _count: { accounts: number; transactions: number; subscriptions: number; savingsGoals: number };
}

type StatusFilter = "all" | "active" | "suspended" | "unverified";
type SortOption = "createdAt_desc" | "createdAt_asc" | "balance_desc" | "balance_asc";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortOption>("createdAt_desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fonction volontairement non-async : aucun setState synchrone dans le
  // corps (uniquement dans les callbacks .then/.catch/.finally), pour
  // pouvoir être appelée directement depuis un useEffect sans déclencher
  // react-hooks/set-state-in-effect (même convention que GoalsTable.tsx).
  const load = useCallback((searchQuery: string, pageNum: number, statusFilter: StatusFilter, sortOption: SortOption) => {
    const params = new URLSearchParams({ page: String(pageNum), status: statusFilter, sort: sortOption });
    if (searchQuery) params.set("q", searchQuery);
    return fetch(`/api/admin/users?${params.toString()}`)
      .then((res) => res.json())
      .then((result) => {
        if (!result.success) {
          setError(result.error || "Erreur de chargement");
          return;
        }
        setError(null);
        setUsers(result.data);
        setTotalPages(result.pagination.totalPages);
        setTotal(result.pagination.total);
      })
      .catch(() => setError("Erreur réseau"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(q, page, status, sort);
  }, [load, page, q, status, sort]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPage(1);
    load(q, 1, status, sort);
  };

  const handleStatusChange = (next: StatusFilter) => {
    setLoading(true);
    setStatus(next);
    setPage(1);
  };

  const handleSortChange = (next: SortOption) => {
    setLoading(true);
    setSort(next);
    setPage(1);
  };

  const toggleSuspend = async (user: UserRow) => {
    setBusyId(user.id);
    try {
      if (user.isSuspended) {
        await fetch(`/api/admin/users/${user.id}/reactivate`, { method: "POST" });
      } else {
        const reason = window.prompt("Raison de la suspension (optionnel) :") ?? "";
        await fetch(`/api/admin/users/${user.id}/suspend`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
      }
      await load(q, page, status, sort);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 text-ink">
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Utilisateurs</h1>
          <p className="text-subtle text-sm mt-1">{total} compte{total === 1 ? "" : "s"} au total.</p>
        </div>
        <a
          href="/api/admin/users/export"
          download
          className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-2 rounded-lg bg-surface border border-line text-body-soft hover:text-ink transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Exporter en CSV
        </a>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative max-w-md flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher par email ou nom…"
            className="w-full bg-surface border border-line text-ink rounded-lg py-2.5 pl-10 pr-4 text-sm focus:border-amber-500 outline-none transition-colors"
          />
        </form>
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value as StatusFilter)}
          className="bg-surface border border-line text-ink rounded-lg py-2.5 px-3 text-sm focus:border-amber-500 outline-none transition-colors"
        >
          <option value="all">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="suspended">Suspendus</option>
          <option value="unverified">Email non vérifié</option>
        </select>
        <select
          value={sort}
          onChange={(e) => handleSortChange(e.target.value as SortOption)}
          className="bg-surface border border-line text-ink rounded-lg py-2.5 px-3 text-sm focus:border-amber-500 outline-none transition-colors"
        >
          <option value="createdAt_desc">Plus récents d&apos;abord</option>
          <option value="createdAt_asc">Plus anciens d&apos;abord</option>
          <option value="balance_desc">Solde décroissant</option>
          <option value="balance_asc">Solde croissant</option>
        </select>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[13px]">{error}</div>
      )}

      <div className="bg-surface border border-line rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-faint text-[11px] uppercase tracking-widest border-b border-line">
              <th className="px-4 py-3 font-semibold">Utilisateur</th>
              <th className="px-4 py-3 font-semibold">Statut</th>
              <th className="px-4 py-3 font-semibold hidden sm:table-cell">Données</th>
              <th className="px-4 py-3 font-semibold hidden md:table-cell">Inscrit le</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-faint">
                  <Loader2 className="w-5 h-5 animate-spin inline-block" />
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-faint">
                  Aucun utilisateur trouvé.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-b border-line-subtle last:border-0 hover:bg-surface-alt">
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${user.id}`} className="font-semibold text-ink hover:text-amber-400">
                      {user.name || user.email}
                    </Link>
                    {user.name && <div className="text-[12px] text-faint">{user.email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {user.isSuspended ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/25">
                          Suspendu
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                          Actif
                        </span>
                      )}
                      {!user.emailVerified && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/25">
                          Email non vérifié
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted text-[13px]">
                    {user._count.accounts} comptes · {user._count.transactions} transactions
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted text-[13px]">
                    {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleSuspend(user)}
                      disabled={busyId === user.id}
                      className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                        user.isSuspended
                          ? "text-emerald-300 hover:bg-emerald-500/10"
                          : "text-red-300 hover:bg-red-500/10"
                      }`}
                    >
                      {busyId === user.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : user.isSuspended ? (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      ) : (
                        <ShieldBan className="w-3.5 h-3.5" />
                      )}
                      {user.isSuspended ? "Réactiver" : "Suspendre"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
