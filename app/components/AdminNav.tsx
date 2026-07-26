"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, LogOut, Users, LayoutDashboard, ScrollText, UserCog, Repeat, ShieldQuestion } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const navLinks = [
  { href: "/admin", label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Utilisateurs", icon: Users, exact: false },
  { href: "/admin/features", label: "Fonctionnalités", icon: ShieldQuestion, exact: false },
  { href: "/admin/subscriptions", label: "Abonnements", icon: Repeat, exact: false },
  { href: "/admin/audit-log", label: "Journal d'audit", icon: ScrollText, exact: false },
  { href: "/admin/admins", label: "Admins", icon: UserCog, exact: false },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    fetch("/api/admin/me")
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setAdminEmail(result.admin.name || result.admin.email);
      })
      .catch(() => {});
  }, [pathname]);

  if (pathname === "/admin/login") return null;

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <nav className="bg-surface-alt border-b border-line text-ink sticky top-0 z-[60]">
      <div className="flex items-center justify-between h-16 px-4 mx-auto sm:px-6 lg:px-10 gap-4">
        <Link className="flex items-center gap-2 shrink-0" href="/admin">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-lg font-black tracking-tighter hidden md:inline">
            Wealth OS <span className="text-amber-400">Admin</span>
          </span>
        </Link>

        <div className="items-center hidden gap-1 sm:flex overflow-x-auto">
          {navLinks.map((link) => {
            const isActive = link.exact ? pathname === link.href : pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-md transition-all text-[13px] font-medium whitespace-nowrap ${
                  isActive ? "text-amber-400 bg-amber-500/10" : "text-body-soft hover:text-amber-400 hover:bg-surface-strong"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <ThemeToggle />
          {adminEmail && <span className="text-[12px] text-muted max-w-[160px] truncate hidden lg:inline">{adminEmail}</span>}
          <button
            onClick={handleLogout}
            title="Déconnexion"
            aria-label="Déconnexion"
            className="p-2 rounded-lg text-muted hover:text-red-400 hover:bg-surface-strong transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Nav mobile (sm:hidden) */}
      <div className="flex sm:hidden items-center gap-1 px-2 pb-2 overflow-x-auto">
        {navLinks.map((link) => {
          const isActive = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all text-[12px] font-medium whitespace-nowrap shrink-0 ${
                isActive ? "text-amber-400 bg-amber-500/10" : "text-body-soft hover:text-amber-400 hover:bg-surface-alt"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
