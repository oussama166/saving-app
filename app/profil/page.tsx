"use client";

import { useEffect, useState } from "react";
import {
  SlidersHorizontal,
  FileSpreadsheet,
  Loader2,
  Download,
  ShieldCheck,
  MailWarning,
} from "lucide-react";
import ProfileAllocationEditor, {
  AllocationRow,
} from "../components/ProfileAllocationEditor";
import RealBudgetOptimizer from "../components/RealBudgetOptimizer";
import WebhookTokenCard from "../components/WebhookTokenCard";
import AccountSecurityCard from "../components/AccountSecurityCard";

export default function ProfilPage() {
  const [referenceIncome, setReferenceIncome] = useState(10000);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generatingBilan, setGeneratingBilan] = useState(false);
  const [bilanError, setBilanError] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setReferenceIncome(result.data.referenceIncome);
          setAllocations(
            result.data.categories.map(
              (c: { id: string; name: string; budgetPct: number }) => ({
                id: c.id,
                name: c.name,
                budgetPct: c.budgetPct,
              }),
            ),
          );
          setUpdatedAt(result.data.updatedAt);
        }
      })
      .catch((err) => console.error("Settings fetch error:", err))
      .finally(() => setLoading(false));

    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setEmailVerified(Boolean(result.user.emailVerified));
      })
      .catch((err) => console.error("Me fetch error:", err));
  }, []);

  const handleAllocationChange = (id: string, pct: number) => {
    setSaved(false);
    setAllocations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, budgetPct: pct } : a)),
    );
  };

  const handleApplyReal = (
    realAllocations: { id: string; budgetPct: number }[],
  ) => {
    setSaved(false);
    setAllocations((prev) =>
      prev.map((a) => {
        const match = realAllocations.find((r) => r.id === a.id);
        return match ? { ...a, budgetPct: match.budgetPct } : a;
      }),
    );
  };

  const handleGenerateBilan = async () => {
    setGeneratingBilan(true);
    setBilanError(null);
    try {
      const res = await fetch("/api/reports/bilan");
      if (!res.ok) {
        throw new Error("Échec de la génération du bilan");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `bilan-financier-${today}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Bilan generation error:", err);
      setBilanError("Impossible de générer le bilan. Réessayez.");
    } finally {
      setGeneratingBilan(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceIncome,
          allocations: allocations.map((a) => ({
            id: a.id,
            budgetPct: a.budgetPct,
          })),
        }),
      });
      const result = await res.json();
      if (result.success) {
        setSaved(true);
        setUpdatedAt(new Date().toISOString());
      }
    } catch (err) {
      console.error("Settings save error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 font-sans bg-page text-body">
      <div className="mx-auto space-y-8 max-w-7xl">
        <div className="flex items-center gap-4 p-6 border bg-surface rounded-2xl border-line">
          <div className="p-3 border bg-blue-600/20 rounded-xl border-blue-500/20">
            <SlidersHorizontal className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight uppercase text-ink">
              Paramétrage &amp; Profil Intelligent
            </h1>
            <p className="text-subtle text-sm mt-0.5">
              Adaptez la théorie financière du 50/30/20 à la réalité concrète de
              votre vie à Tanger.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-12 h-12 border-b-2 border-blue-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid items-start grid-cols-1 gap-8 lg:grid-cols-2">
            <ProfileAllocationEditor
              referenceIncome={referenceIncome}
              onReferenceIncomeChange={(v) => {
                setSaved(false);
                setReferenceIncome(v);
              }}
              allocations={allocations}
              onAllocationChange={handleAllocationChange}
              onSave={handleSave}
              saving={saving}
              saved={saved}
            />
            <RealBudgetOptimizer onApply={handleApplyReal} />
          </div>
        )}

        <div className="flex flex-col items-start justify-between gap-4 p-6 border bg-surface rounded-2xl border-line sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 border bg-emerald-600/20 rounded-xl border-emerald-500/20">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight uppercase text-ink">
                Générateur de Bilan Excel
              </h2>
              <p className="text-subtle text-xs mt-0.5 max-w-md">
                Export .xlsx complet : résumé mensuel &amp; budget, historique
                de toutes les transactions, et patrimoine (portefeuille,
                objectifs, fonds d&apos;urgence).
              </p>
              {bilanError && (
                <p className="mt-1 text-xs text-red-400">{bilanError}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleGenerateBilan}
            disabled={generatingBilan}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            {generatingBilan ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Génération...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Télécharger le bilan
              </>
            )}
          </button>
        </div>

        <AccountSecurityCard />

        {emailVerified ? (
          <WebhookTokenCard />
        ) : (
          <LockedWebhookCard verified={emailVerified} />
        )}

        <p className="text-center text-[11px] text-faint pt-4">
          Système conçu pour épargne · Règle 50/30/20 enrichie
          {updatedAt &&
            ` · Dernière mise à jour : ${new Date(updatedAt).toLocaleDateString("fr-FR")}`}
        </p>
      </div>
    </main>
  );
}

function LockedWebhookCard({ verified }: { verified: boolean | null }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResend = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      const result = await res.json();
      if (result.success) setSent(true);
    } catch (err) {
      console.error("Resend verification error:", err);
    } finally {
      setSending(false);
    }
  };

  if (verified === null) {
    return (
      <div className="p-6 border bg-surface rounded-2xl border-line">
        <div className="flex items-center gap-2 text-xs text-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 border bg-surface rounded-2xl border-line space-y-4">
      <div className="flex items-center gap-4">
        <div className="p-3 border bg-orange-600/20 rounded-xl border-orange-500/20">
          <ShieldCheck className="w-6 h-6 text-orange-400" />
        </div>
        <div>
          <h2 className="text-sm font-black tracking-tight uppercase text-ink">
            Token Webhook (iOS Shortcut)
          </h2>
          <p className="text-subtle text-xs mt-0.5 max-w-md">
            Vérifie ton email pour débloquer la génération du token webhook (utilisé par
            les iOS Shortcuts Apple Pay / Salaire).
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-line-subtle pt-4">
        <MailWarning className="w-4 h-4 text-orange-400 shrink-0" />
        {sent ? (
          <span className="text-xs text-emerald-400 font-medium">Email de vérification envoyé.</span>
        ) : (
          <button
            onClick={handleResend}
            disabled={sending}
            className="flex items-center gap-2 text-xs font-bold text-orange-400 hover:text-orange-300 disabled:opacity-50"
          >
            {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Renvoyer l&apos;email de vérification
          </button>
        )}
      </div>
    </div>
  );
}
