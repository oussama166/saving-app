"use client";

import { useEffect, useState } from "react";
import {
  SlidersHorizontal,
  FileSpreadsheet,
  FileText,
  Loader2,
  Download,
  ShieldCheck,
  MailWarning,
  DatabaseBackup,
} from "lucide-react";
import ProfileAllocationEditor, {
  AllocationRow,
} from "../components/ProfileAllocationEditor";
import BudgetMethodSelector from "../components/BudgetMethodSelector";
import RealBudgetOptimizer from "../components/RealBudgetOptimizer";
import WebhookTokenCard from "../components/WebhookTokenCard";
import PushNotificationCard from "../components/PushNotificationCard";
import AccountSecurityCard from "../components/AccountSecurityCard";
import SessionsCard from "../components/SessionsCard";
import TwoFactorCard from "../components/TwoFactorCard";
import HouseholdCard from "../components/HouseholdCard";
import AccountsCard from "../components/AccountsCard";
import TransferCard from "../components/TransferCard";
import RecurringTransfersCard from "../components/RecurringTransfersCard";
import FeatureGate from "../components/FeatureGate";
import FeatureDisabledInlineCard from "../components/FeatureDisabledInlineCard";

const PROFILE_SUBFEATURE_KEYS = [
  "profile.budget_allocation",
  "profile.export_excel",
  "profile.export_pdf",
  "profile.account_security",
  "profile.two_factor",
  "profile.household",
  "profile.accounts",
  "profile.webhook_token",
] as const;

type ProfileSubfeatureKey = (typeof PROFILE_SUBFEATURE_KEYS)[number];
type SubfeatureStatusMap = Record<ProfileSubfeatureKey, { allowed: boolean; message: string | null }>;

export default function ProfilPage() {
  return (
    <FeatureGate featureKey="profile" featureName="Profil & Réglages">
      <ProfilPageContent />
    </FeatureGate>
  );
}

function ProfilPageContent() {
  const [referenceIncome, setReferenceIncome] = useState(10000);
  const [budgetCycleStartDay, setBudgetCycleStartDay] = useState(1);
  const [budgetMethod, setBudgetMethod] = useState("503020");
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generatingBilan, setGeneratingBilan] = useState(false);
  const [bilanError, setBilanError] = useState<string | null>(null);
  const [generatingBilanPdf, setGeneratingBilanPdf] = useState(false);
  const [bilanPdfError, setBilanPdfError] = useState<string | null>(null);
  const [generatingBackup, setGeneratingBackup] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [subfeatures, setSubfeatures] = useState<SubfeatureStatusMap | null>(null);

  useEffect(() => {
    fetch(`/api/features/check?keys=${PROFILE_SUBFEATURE_KEYS.join(",")}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((result) => {
        // Fail-open : en cas d'échec de la vérification, on affiche tout
        // plutôt que de bloquer par erreur (même politique que <FeatureGate>).
        if (result.success) {
          setSubfeatures(result.data);
        } else {
          setSubfeatures(
            Object.fromEntries(PROFILE_SUBFEATURE_KEYS.map((k) => [k, { allowed: true, message: null }])) as SubfeatureStatusMap,
          );
        }
      })
      .catch(() =>
        setSubfeatures(
          Object.fromEntries(PROFILE_SUBFEATURE_KEYS.map((k) => [k, { allowed: true, message: null }])) as SubfeatureStatusMap,
        ),
      );

    fetch("/api/settings")
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setReferenceIncome(result.data.referenceIncome);
          setBudgetCycleStartDay(result.data.budgetCycleStartDay ?? 1);
          setBudgetMethod(result.data.budgetMethod ?? "503020");
          setAllocations(
            result.data.categories.map(
              (c: { id: string; name: string; type: string; budgetPct: number; budgetGroup: string | null }) => ({
                id: c.id,
                name: c.name,
                type: c.type,
                budgetPct: c.budgetPct,
                budgetGroup: c.budgetGroup,
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

  const handleBudgetGroupChange = (id: string, group: "essential" | "discretionary") => {
    setSaved(false);
    setAllocations((prev) => prev.map((a) => (a.id === id ? { ...a, budgetGroup: group } : a)));
  };

  // Le choix de méthode se sauvegarde immédiatement (pas besoin d'attendre le
  // bouton "Enregistrer" de l'éditeur d'allocations, qui reste bloqué tant
  // que la somme des % n'est pas à 100 — la méthode, elle, n'a pas cette
  // contrainte) en renvoyant les allocations déjà chargées telles quelles.
  const handleBudgetMethodChange = async (key: string) => {
    setBudgetMethod(key);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceIncome,
          budgetCycleStartDay,
          budgetMethod: key,
          allocations: allocations.map((a) => ({ id: a.id, budgetPct: a.budgetPct, budgetGroup: a.budgetGroup ?? null })),
        }),
      });
    } catch (err) {
      console.error("Budget method save error:", err);
    }
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

  const handleGenerateBilanPdf = async () => {
    setGeneratingBilanPdf(true);
    setBilanPdfError(null);
    try {
      const res = await fetch("/api/reports/bilan-pdf");
      if (!res.ok) {
        throw new Error("Échec de la génération du PDF");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `bilan-financier-${today}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Bilan PDF generation error:", err);
      setBilanPdfError("Impossible de générer le PDF. Réessayez.");
    } finally {
      setGeneratingBilanPdf(false);
    }
  };

  const handleGenerateBackup = async () => {
    setGeneratingBackup(true);
    setBackupError(null);
    try {
      const res = await fetch("/api/export/backup");
      if (!res.ok) {
        throw new Error("Échec de la génération de la sauvegarde");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `wealthos-backup-${today}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Backup export error:", err);
      setBackupError("Impossible de générer la sauvegarde. Réessayez.");
    } finally {
      setGeneratingBackup(false);
    }
  };

  // Optimiste tant que la vérification n'est pas revenue (subfeatures ===
  // null) : on affiche tout par défaut plutôt que de faire clignoter les
  // cartes (masquées puis réaffichées) — cohérent avec la politique
  // fail-open du reste du système de fonctionnalités.
  const isSubfeatureAllowed = (key: ProfileSubfeatureKey) => subfeatures === null || subfeatures[key]?.allowed !== false;
  const subfeatureMessage = (key: ProfileSubfeatureKey) => subfeatures?.[key]?.message ?? null;

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceIncome,
          budgetCycleStartDay,
          budgetMethod,
          allocations: allocations.map((a) => ({
            id: a.id,
            budgetPct: a.budgetPct,
            budgetGroup: a.budgetGroup ?? null,
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
              Choisissez la méthodologie de budget qui vous parle, et adaptez-la à la
              réalité concrète de votre vie à Tanger.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-12 h-12 border-b-2 border-blue-500 rounded-full animate-spin" />
          </div>
        ) : !isSubfeatureAllowed("profile.budget_allocation") ? (
          <FeatureDisabledInlineCard
            featureName="Allocation budgétaire (50/30/20)"
            message={subfeatureMessage("profile.budget_allocation")}
          />
        ) : (
          <>
            <BudgetMethodSelector value={budgetMethod} onChange={handleBudgetMethodChange} />
            <div className="grid items-start grid-cols-1 gap-8 lg:grid-cols-2">
              <ProfileAllocationEditor
                referenceIncome={referenceIncome}
                onReferenceIncomeChange={(v) => {
                  setSaved(false);
                  setReferenceIncome(v);
                }}
                budgetCycleStartDay={budgetCycleStartDay}
                onBudgetCycleStartDayChange={(v) => {
                  setSaved(false);
                  setBudgetCycleStartDay(v);
                }}
                allocations={allocations}
                onAllocationChange={handleAllocationChange}
                onBudgetGroupChange={handleBudgetGroupChange}
                onSave={handleSave}
                saving={saving}
                saved={saved}
              />
              <RealBudgetOptimizer onApply={handleApplyReal} />
            </div>
          </>
        )}

        {!isSubfeatureAllowed("profile.export_excel") ? (
          <FeatureDisabledInlineCard featureName="Export Bilan Excel" message={subfeatureMessage("profile.export_excel")} />
        ) : (
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
        )}

        {!isSubfeatureAllowed("profile.export_pdf") ? (
          <FeatureDisabledInlineCard featureName="Export Bilan PDF" message={subfeatureMessage("profile.export_pdf")} />
        ) : (
          <div className="flex flex-col items-start justify-between gap-4 p-6 border bg-surface rounded-2xl border-line sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <div className="p-3 border bg-red-600/20 rounded-xl border-red-500/20">
                <FileText className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-sm font-black tracking-tight uppercase text-ink">
                  Bilan PDF (résumé imprimable)
                </h2>
                <p className="text-subtle text-xs mt-0.5 max-w-md">
                  Une page condensée : indicateurs du mois, budget par catégorie et patrimoine net — sans le détail des
                  transactions (voir l&apos;export Excel pour l&apos;historique complet).
                </p>
                {bilanPdfError && (
                  <p className="mt-1 text-xs text-red-400">{bilanPdfError}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleGenerateBilanPdf}
              disabled={generatingBilanPdf}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
            >
              {generatingBilanPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Télécharger en PDF
                </>
              )}
            </button>
          </div>
        )}

        <div className="flex flex-col items-start justify-between gap-4 p-6 border bg-surface rounded-2xl border-line sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 border bg-blue-600/20 rounded-xl border-blue-500/20">
              <DatabaseBackup className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight uppercase text-ink">
                Sauvegarde complète (JSON)
              </h2>
              <p className="text-subtle text-xs mt-0.5 max-w-md">
                Toutes tes données brutes (comptes, transactions, abonnements, dettes, objectifs, portefeuille...) dans
                un seul fichier, à garder de ton côté par sécurité.
              </p>
              {backupError && <p className="mt-1 text-xs text-red-400">{backupError}</p>}
            </div>
          </div>
          <button
            onClick={handleGenerateBackup}
            disabled={generatingBackup}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            {generatingBackup ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Génération...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Télécharger la sauvegarde
              </>
            )}
          </button>
        </div>

        <PushNotificationCard />

        {isSubfeatureAllowed("profile.account_security") ? (
          <AccountSecurityCard />
        ) : (
          <FeatureDisabledInlineCard featureName="Sécurité du compte" message={subfeatureMessage("profile.account_security")} />
        )}

        <SessionsCard />

        {isSubfeatureAllowed("profile.two_factor") ? (
          <TwoFactorCard />
        ) : (
          <FeatureDisabledInlineCard
            featureName="Authentification à deux facteurs"
            message={subfeatureMessage("profile.two_factor")}
          />
        )}

        {isSubfeatureAllowed("profile.household") ? (
          <HouseholdCard />
        ) : (
          <FeatureDisabledInlineCard featureName="Foyer partagé" message={subfeatureMessage("profile.household")} />
        )}

        {isSubfeatureAllowed("profile.accounts") ? (
          <>
            <AccountsCard />
            {/* Même sous-fonctionnalité que AccountsCard : le virement entre
                comptes (ponctuel et récurrent) fait partie de la gestion des
                comptes, pas une capacité distincte à activer séparément. */}
            <TransferCard />
            <RecurringTransfersCard />
          </>
        ) : (
          <FeatureDisabledInlineCard
            featureName="Comptes bancaires (multi-devises)"
            message={subfeatureMessage("profile.accounts")}
          />
        )}

        {!isSubfeatureAllowed("profile.webhook_token") ? (
          <FeatureDisabledInlineCard
            featureName="Token Webhook (iOS Shortcut)"
            message={subfeatureMessage("profile.webhook_token")}
          />
        ) : emailVerified ? (
          <WebhookTokenCard />
        ) : (
          <LockedWebhookCard verified={emailVerified} />
        )}

        <p className="text-center text-[11px] text-faint pt-4">
          Système conçu pour épargne · 8 méthodologies de budget disponibles
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
