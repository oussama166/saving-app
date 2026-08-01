"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Loader2, Check } from "lucide-react";
import { useLanguage } from "./LanguageProvider";

interface AccountRow {
  id: string;
  name: string;
  currency: string;
  balance: number;
}

// Petit formulaire qui appelle POST /api/transfer (moteur déjà en place,
// débite un compte + crédite l'autre + crée les deux lignes de transaction
// liées) — jusqu'ici aucune UI ne déclenchait cette route. Charge sa propre
// liste de comptes (comme AccountsCard) plutôt que de dépendre d'une prop
// venant du composant serveur parent, pour rester à jour immédiatement
// après la création d'un compte dans AccountsCard juste au-dessus.
export default function TransferCard() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);

  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = () => {
    fetch("/api/accounts")
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          const list: AccountRow[] = result.data;
          setAccounts(list);
          // Ne réinitialise le choix que s'il n'existe plus (compte
          // supprimé) — évite de perdre la sélection de l'utilisateur à
          // chaque refresh déclenché après un virement.
          setFromAccountId((prev) =>
            list.some((a) => a.id === prev) ? prev : (list[0]?.id ?? ""),
          );
          setToAccountId((prev) =>
            list.some((a) => a.id === prev)
              ? prev
              : (list[1]?.id ?? list[0]?.id ?? ""),
          );
        }
      })
      .catch((err) => console.error("Accounts fetch error:", err))
      .finally(() => setLoadingAccounts(false));
  };

  useEffect(() => {
    load();
  }, []);

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const sameAccount = Boolean(fromAccountId) && fromAccountId === toAccountId;
  const numericAmount = Number(amount);
  const amountValid =
    amount !== "" && Number.isFinite(numericAmount) && numericAmount > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (sameAccount) {
      setError(t("transfer.errorSameAccount"));
      return;
    }
    if (!amountValid) return;

    setBusy(true);
    try {
      const res = await fetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAccountId,
          toAccountId,
          amount: numericAmount,
        }),
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        setError(
          result.error === "Insufficient funds"
            ? t("transfer.errorInsufficientFunds")
            : t("transfer.errorGeneric"),
        );
        return;
      }
      setSuccess(true);
      setAmount("");
      load();
      router.refresh();
    } catch (err) {
      console.error("Transfer error:", err);
      setError(t("transfer.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  if (loadingAccounts) {
    return (
      <div className="p-6 border bg-surface rounded-2xl border-line">
        <div className="flex items-center gap-2 text-xs text-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("common.loading")}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 border bg-surface rounded-2xl border-line space-y-4">
      <div className="flex items-center gap-4">
        <div className="p-3 border rounded-xl bg-indigo-600/20 border-indigo-500/20">
          <ArrowLeftRight className="w-6 h-6 text-indigo-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-black tracking-tight uppercase text-ink">
            {t("transfer.title")}
          </h2>
          <p className="text-subtle text-xs mt-0.5">{t("transfer.subtitle")}</p>
        </div>
      </div>

      {accounts.length < 2 ? (
        <p className="text-xs text-subtle pt-4 border-t border-line-subtle">
          {t("transfer.needTwoAccounts")}
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 pt-4 border-t border-line-subtle"
        >
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-1.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[13px]">
              <Check className="w-3.5 h-3.5" />
              {t("transfer.success")}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                {t("transfer.from")}
              </label>
              <select
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                className="w-full bg-page border border-line text-body rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id} className="truncate">
                    {a.name} (
                    {a.balance.toLocaleString("fr-FR", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    {a.currency})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                {t("transfer.to")}
              </label>
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="w-full bg-page border border-line text-body rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                {t("transfer.amount")}{" "}
                {fromAccount ? `(${fromAccount.currency})` : ""}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-page border border-line text-body rounded-lg p-2.5 text-sm font-bold outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {sameAccount && (
            <p className="text-xs text-amber-300">
              {t("transfer.errorSameAccount")}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || sameAccount || !amountValid}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowLeftRight className="w-4 h-4" />
            )}
            {t("transfer.submit")}
          </button>
        </form>
      )}
    </div>
  );
}
