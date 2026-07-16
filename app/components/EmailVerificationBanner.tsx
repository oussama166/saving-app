"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MailWarning, X, Loader2 } from "lucide-react";
import { useLanguage } from "./LanguageProvider";

const AUTH_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password"];

export default function EmailVerificationBanner() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (AUTH_PATHS.includes(pathname)) return;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setEmailVerified(Boolean(result.user.emailVerified));
      })
      .catch(() => {});
  }, [pathname]);

  if (AUTH_PATHS.includes(pathname)) return null;
  if (emailVerified !== false || dismissed) return null;

  const handleResend = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      const result = await res.json();
      if (result.success) setSent(true);
    } catch {
      // silencieux — l'utilisateur peut réessayer
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-orange-500/10 border-b border-orange-500/20 text-orange-300 text-[13px]">
      <div className="mx-auto px-4 sm:px-6 lg:px-10 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MailWarning className="w-4 h-4 shrink-0" />
          <span>
            {sent
              ? t("emailVerify.sent")
              : t("emailVerify.notVerified")}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {!sent && (
            <button
              onClick={handleResend}
              disabled={sending}
              className="font-bold underline hover:text-orange-200 disabled:opacity-50 flex items-center gap-1.5"
            >
              {sending && <Loader2 className="w-3 h-3 animate-spin" />}
              {t("emailVerify.resend")}
            </button>
          )}
          <button
            onClick={() => setDismissed(true)}
            aria-label={t("common.close")}
            className="text-orange-300/70 hover:text-orange-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
