"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { KeyRound, CheckCircle2 } from "lucide-react";
import Logo from "../components/Logo";
import PasswordInput from "../components/PasswordInput";
import { useLanguage } from "../components/LanguageProvider";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { t } = useLanguage();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError(t("auth.resetPasswordInvalidLink"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.errorPasswordMismatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("auth.errorPasswordTooShort"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const result = await res.json();
      if (!result.success) {
        setError(result.error || t("auth.errorNetwork"));
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
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
          <h1 className="text-2xl font-black tracking-tighter text-ink">{t("auth.resetPasswordTitle")}</h1>
        </div>

        <div className="bg-surface border border-line rounded-2xl p-8 space-y-5">
          {!token ? (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
              {t("auth.resetPasswordInvalidLink")}
            </div>
          ) : success ? (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[13px] flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{t("auth.resetPasswordSuccess")}</span>
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
                  {t("auth.newPassword")}
                </label>
                <PasswordInput
                  required
                  value={password}
                  onChange={setPassword}
                  placeholder={t("auth.passwordMinChars")}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                  {t("auth.confirmPassword")}
                </label>
                <PasswordInput
                  required
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="••••••••"
                  autoComplete="new-password"
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
                  <>
                    <KeyRound className="w-4 h-4" />
                    {t("auth.resetPasswordSubmit")}
                  </>
                )}
              </button>
            </form>
          )}

          <p className="text-center text-[13px] text-subtle">
            <Link href="/login" className="text-blue-400 font-semibold hover:text-blue-300">
              {t("auth.backToLogin")}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
