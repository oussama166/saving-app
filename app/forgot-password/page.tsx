"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";
import Logo from "../components/Logo";
import { useLanguage } from "../components/LanguageProvider";

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Toujours afficher le même message de succès, que l'email existe ou
      // non (voir app/api/auth/forgot-password/route.ts).
      setSent(true);
    } catch {
      setError(t("auth.errorNetwork"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-page flex items-center justify-center p-6 text-body font-sans">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3">
          <Logo size={56} className="shadow-lg shadow-blue-900/20 rounded-2xl" />
          <h1 className="text-2xl font-black tracking-tighter text-ink">{t("auth.forgotPasswordTitle")}</h1>
          <p className="text-subtle text-sm text-center">{t("auth.forgotPasswordSubtitle")}</p>
        </div>

        <div className="bg-surface border border-line rounded-2xl p-8 space-y-5">
          {sent ? (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[13px] flex items-start gap-2">
              <Mail className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{t("auth.forgotPasswordSent")}</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                  {t("auth.email")}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="toi@example.com"
                  className="w-full bg-page border border-line text-body rounded-lg p-3 focus:border-blue-500 outline-none transition-colors text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50 text-sm"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  t("auth.forgotPasswordSubmit")
                )}
              </button>
            </form>
          )}

          <p className="text-center text-[13px] text-subtle">
            <Link href="/login" className="text-blue-400 font-semibold hover:text-blue-300 inline-flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              {t("auth.backToLogin")}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
