"use client";

import { useEffect, useRef, useState } from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { useTheme, type ThemeChoice } from "./ThemeProvider";
import { useOptionalLanguage } from "./LanguageProvider";

const OPTIONS: { key: ThemeChoice; labelKey: string; icon: typeof Sun }[] = [
  { key: "system", labelKey: "theme.system", icon: Monitor },
  { key: "light", labelKey: "theme.light", icon: Sun },
  { key: "dark", labelKey: "theme.dark", icon: Moon },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useOptionalLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // `theme` vient de localStorage (lu côté client uniquement), donc son état
  // initial diffère forcément du rendu SSR (qui suppose toujours 'system').
  // Tant que le composant n'est pas monté, on affiche l'icône "système" par
  // défaut (identique des deux côtés) puis on corrige au montage — évite le
  // mismatch d'hydratation.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const activeChoice = mounted ? theme : "system";
  const TriggerIcon =
    OPTIONS.find((o) => o.key === activeChoice)?.icon ?? Monitor;

  const handleSelect = (next: ThemeChoice) => {
    setTheme(next);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={t("theme.label")}
        aria-label={t("theme.label")}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-subtle hover:text-body hover:bg-surface-strong transition-colors"
      >
        <TriggerIcon className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-36 bg-surface border border-line rounded-xl shadow-2xl overflow-hidden z-50">
          {OPTIONS.map(({ key, labelKey, icon: Icon }) => {
            const active = mounted && theme === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSelect(key)}
                aria-pressed={active}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-[12px] font-medium transition-colors ${
                  active
                    ? "text-blue-400 bg-blue-500/10"
                    : "text-body-soft hover:bg-surface-alt"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5" />
                  {t(labelKey)}
                </span>
                {active && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
