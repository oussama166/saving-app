"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, X } from "lucide-react";
import { useLanguage } from "./LanguageProvider";

const AUTH_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password"];
const DISMISS_KEY = "wealthos-install-banner-dismissed";

// L'événement beforeinstallprompt (Chrome/Edge/Android) n'a pas de type
// officiel dans lib.dom.d.ts — TypeScript ne le connaît pas nativement.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Bandeau "Installer l'app" — UNIQUEMENT sur Chrome/Edge/Android, qui sont
// les seuls navigateurs à émettre beforeinstallprompt. Safari/iOS ne le
// supporte pas du tout (l'utilisateur doit passer par Partager > Sur l'écran
// d'accueil manuellement, voir README) : sur iOS, ce composant ne s'affiche
// donc simplement jamais, ce qui est le comportement attendu, pas un bug.
export default function InstallAppBanner() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true); // true par défaut : évite un flash avant lecture de localStorage

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return; // déjà installée
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    // Différé en microtask (voir react-hooks/set-state-in-effect) : même
    // pattern que NetWorthChart.tsx/app/page.tsx.
    Promise.resolve().then(() => setDismissed(false));

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    function handleInstalled() {
      setDeferredPrompt(null);
      setDismissed(true);
    }
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (AUTH_PATHS.includes(pathname) || pathname.startsWith("/admin")) return null;
  if (dismissed || !deferredPrompt) return null;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  return (
    <div className="bg-blue-500/10 border-b border-blue-500/20 text-blue-300 text-[13px]">
      <div className="mx-auto px-4 sm:px-6 lg:px-10 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 shrink-0" />
          <span>{t("pwaInstall.title")}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleInstall}
            className="font-bold underline hover:text-blue-200"
          >
            {t("pwaInstall.installButton")}
          </button>
          <button
            onClick={handleDismiss}
            aria-label={t("common.close")}
            className="text-blue-300/70 hover:text-blue-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
