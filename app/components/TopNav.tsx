"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ListEnd,
  Briefcase,
  Target,
  LineChart,
  Heart,
  Bot,
  User,
  LogOut,
  Menu,
  X,
  Repeat,
  ChevronDown,
  CreditCard,
  Gem,
  CalendarDays,
} from "lucide-react";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";
import Logo from "./Logo";
import { useLanguage } from "./LanguageProvider";

const navLinks = [
  {
    key: "nav.dashboard",
    icon: <LayoutDashboard className="w-4 h-4" />,
    href: "/",
  },
  { key: "nav.saisie", icon: <ListEnd className="w-4 h-4" />, href: "/saisie" },
  {
    key: "nav.portfolio",
    icon: <Briefcase className="w-4 h-4" />,
    href: "/portfolio",
  },
  {
    key: "nav.objectifs",
    icon: <Target className="w-4 h-4" />,
    href: "/objectifs",
  },
  {
    key: "nav.analyse",
    icon: <LineChart className="w-4 h-4" />,
    href: "/analyse",
  },
  { key: "nav.sante", icon: <Heart className="w-4 h-4" />, href: "/sante" },
  { key: "nav.coach", icon: <Bot className="w-4 h-4" />, href: "/coach" },
  { key: "nav.zakat", icon: <Gem className="w-4 h-4" />, href: "/zakat" },
  {
    key: "nav.abonnements",
    icon: <Repeat className="w-4 h-4" />,
    href: "/abonnements",
  },
  {
    key: "nav.dettes",
    icon: <CreditCard className="w-4 h-4" />,
    href: "/dettes",
  },
  {
    key: "nav.calendrier",
    icon: <CalendarDays className="w-4 h-4" />,
    href: "/calendrier",
  },
  { key: "nav.profil", icon: <User className="w-4 h-4" />, href: "/profil" },
];

// Regroupement de la nav desktop en grandes catégories (menu déroulant au
// survol/clic) — la liste plate ci-dessus (`navLinks`) reste utilisée telle
// quelle pour le tiroir mobile, où le survol n'a pas de sens et où l'espace
// vertical défile déjà librement. But : réduire le nombre d'items visibles
// d'un coup sur la barre desktop (9 liens à plat -> 2 liens + 3 catégories).
type DesktopNavItem = { key: string; icon: React.ReactNode; href: string };
type DesktopNavEntry =
  | { type: "link"; key: string; icon: React.ReactNode; href: string }
  | { type: "group"; key: string; icon: React.ReactNode; items: DesktopNavItem[] };

const desktopNav: DesktopNavEntry[] = [
  { type: "link", key: "nav.dashboard", icon: <LayoutDashboard className="w-4 h-4" />, href: "/" },
  {
    type: "group",
    key: "nav.group.suivi",
    icon: <ListEnd className="w-4 h-4" />,
    items: [
      { key: "nav.saisie", icon: <ListEnd className="w-4 h-4" />, href: "/saisie" },
      { key: "nav.analyse", icon: <LineChart className="w-4 h-4" />, href: "/analyse" },
    ],
  },
  {
    type: "group",
    key: "nav.group.patrimoine",
    icon: <Briefcase className="w-4 h-4" />,
    items: [
      { key: "nav.portfolio", icon: <Briefcase className="w-4 h-4" />, href: "/portfolio" },
      { key: "nav.objectifs", icon: <Target className="w-4 h-4" />, href: "/objectifs" },
      { key: "nav.abonnements", icon: <Repeat className="w-4 h-4" />, href: "/abonnements" },
      { key: "nav.dettes", icon: <CreditCard className="w-4 h-4" />, href: "/dettes" },
      { key: "nav.calendrier", icon: <CalendarDays className="w-4 h-4" />, href: "/calendrier" },
    ],
  },
  {
    type: "group",
    key: "nav.group.assistant",
    icon: <Bot className="w-4 h-4" />,
    items: [
      { key: "nav.coach", icon: <Bot className="w-4 h-4" />, href: "/coach" },
      { key: "nav.sante", icon: <Heart className="w-4 h-4" />, href: "/sante" },
      { key: "nav.zakat", icon: <Gem className="w-4 h-4" />, href: "/zakat" },
    ],
  },
  { type: "link", key: "nav.profil", icon: <User className="w-4 h-4" />, href: "/profil" },
];

const AUTH_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password"];

function NavGroupDropdown({
  labelKey,
  icon,
  items,
  pathname,
  t,
}: {
  labelKey: string;
  icon: React.ReactNode;
  items: DesktopNavItem[];
  pathname: string;
  t: (key: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isGroupActive = items.some((item) => pathname === item.href);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const openNow = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };

  // Petit délai avant fermeture au survol : laisse le temps au curseur de
  // passer du bouton déclencheur au panneau du menu sans que ça se referme
  // entre les deux (sinon impossible d'atteindre les items en diagonale).
  const closeSoon = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <div className="relative" ref={ref} onMouseEnter={openNow} onMouseLeave={closeSoon}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`relative flex items-center gap-2 px-3 py-2 rounded-md transition-all text-[13px] font-medium ${
          isGroupActive
            ? "text-blue-400 bg-blue-500/10"
            : "text-body-soft hover:text-blue-400 hover:bg-surface-alt"
        }`}
      >
        {icon}
        {t(labelKey)}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        {isGroupActive && (
          <span className="absolute left-2 right-2 -bottom-[1px] h-0.5 rounded-full bg-blue-500" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 mt-1.5 w-56 bg-surface border border-line rounded-xl shadow-2xl overflow-hidden z-50 py-1">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-2.5 px-3 py-2.5 text-[13px] font-medium transition-colors ${
                  isActive ? "text-blue-400 bg-blue-500/10" : "text-body-soft hover:bg-surface-alt"
                }`}
              >
                {item.icon}
                {t(item.key)}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (AUTH_PATHS.includes(pathname) || pathname.startsWith("/admin")) return;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setUserEmail(result.user.name || result.user.email);
      })
      .catch(() => {});
  }, [pathname]);

  // Close the mobile menu whenever the route changes (covers back/forward nav).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (mobileMenuOpen) setMobileMenuOpen(false);
  }

  // Prevent background scroll while the mobile menu is open.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  // Le panel admin (/admin) a son propre système d'auth et sa propre nav
  // (voir app/admin/layout.tsx) — totalement indépendant du compte
  // utilisateur affiché ici.
  if (AUTH_PATHS.includes(pathname) || pathname.startsWith("/admin")) return null;

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <nav className="bg-page border-b border-line-subtle text-body-soft sticky top-0 z-[60]">
      <div className="flex items-center justify-between h-16 px-4 mx-auto sm:px-6 lg:px-10">
        <Link className="flex items-center gap-2" href="/">
          <Logo
            size={30}
            className="shadow-lg shadow-blue-900/20 rounded-[9px]"
          />
          <span className="text-lg font-black tracking-tighter text-ink">
            Wealth OS
          </span>
        </Link>

        <div className="items-center hidden gap-1 lg:flex">
          {desktopNav.map((entry) => {
            if (entry.type === "group") {
              return (
                <NavGroupDropdown
                  key={entry.key}
                  labelKey={entry.key}
                  icon={entry.icon}
                  items={entry.items}
                  pathname={pathname}
                  t={t}
                />
              );
            }
            const isActive = pathname === entry.href;
            return (
              <Link
                key={entry.key}
                href={entry.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex items-center gap-2 px-3 py-2 rounded-md transition-all text-[13px] font-medium ${
                  isActive
                    ? "text-blue-400 bg-blue-500/10"
                    : "text-body-soft hover:text-blue-400 hover:bg-surface-alt"
                }`}
              >
                {entry.icon}
                {t(entry.key)}
                {isActive && (
                  <span className="absolute left-2 right-2 -bottom-[1px] h-0.5 rounded-full bg-blue-500" />
                )}
              </Link>
            );
          })}
        </div>

        <div className="items-center hidden gap-3 lg:flex">
          <LanguageSwitcher />
          <ThemeToggle />
          <div className="w-px h-6 bg-line" />
          <div className="flex items-center gap-2 bg-surface-alt border border-line rounded-xl pl-1.5 pr-1.5 py-1.5">
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
              {userEmail ? (
                userEmail.charAt(0).toUpperCase()
              ) : (
                <User className="w-3.5 h-3.5" />
              )}
            </div>
            {userEmail && (
              <span
                className="text-[12px] text-body-soft max-w-[140px] truncate"
                title={userEmail}
              >
                {userEmail}
              </span>
            )}
            <div className="w-px h-4 bg-line-strong mx-0.5" />
            <button
              onClick={handleLogout}
              title={t("nav.logout")}
              aria-label={t("nav.logout")}
              className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-surface-strong transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <LanguageSwitcher />
          <ThemeToggle />
          <div className="flex items-center gap-1 bg-surface-alt border border-line rounded-xl pl-1.5 pr-1.5 py-1.5">
            <div
              className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[11px] font-bold text-white shrink-0"
              title={userEmail ?? undefined}
            >
              {userEmail ? (
                userEmail.charAt(0).toUpperCase()
              ) : (
                <User className="w-3.5 h-3.5" />
              )}
            </div>
            <button
              onClick={handleLogout}
              title={t("nav.logout")}
              aria-label={t("nav.logout")}
              className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-surface-strong transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-menu"
            className="p-2 transition-colors rounded-lg cursor-pointer text-muted hover:text-ink hover:bg-surface-alt"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      <div
        id="mobile-nav-menu"
        className={`lg:hidden overflow-hidden transition-[max-height] duration-300 ease-in-out ${
          mobileMenuOpen
            ? "max-h-[calc(100vh-4rem)] overflow-y-auto"
            : "max-h-0"
        }`}
      >
        <div className="flex flex-col gap-1 px-4 pt-1 pb-4 border-t border-line-subtle bg-page">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.key}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all text-sm font-medium ${
                  isActive
                    ? "text-blue-400 bg-blue-500/10"
                    : "text-body-soft hover:text-blue-400 hover:bg-surface-alt"
                }`}
              >
                {link.icon}
                {t(link.key)}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
