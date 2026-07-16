"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type ThemeChoice } from "./ThemeProvider";

const OPTIONS: { key: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { key: "light", label: "Clair", icon: Sun },
  { key: "dark", label: "Sombre", icon: Moon },
  { key: "system", label: "Système", icon: Monitor },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  // `theme` vient de localStorage (lu côté client uniquement), donc son état
  // initial diffère forcément du rendu SSR (qui suppose toujours 'system').
  // Tant que le composant n'est pas monté, on affiche les 3 boutons sans
  // bouton actif — identique des deux côtés — puis on corrige au montage.
  // Évite le mismatch d'hydratation sur aria-pressed/className.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="flex items-center gap-0.5 bg-surface-alt border border-line rounded-xl p-0.5">
      {OPTIONS.map(({ key, label, icon: Icon }) => {
        const active = mounted && theme === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setTheme(key)}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className={`flex items-center justify-center p-1.5 rounded-lg transition-colors ${
              active
                ? "bg-blue-600 text-white"
                : "text-subtle hover:text-body hover:bg-surface-strong"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
    </div>
  );
}
