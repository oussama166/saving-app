import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { Wallet } from "lucide-react";

interface AccountBalance {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
}

const TYPE_KEY: Record<string, string> = {
  checking: "account.type.checking",
  savings: "account.type.savings",
  investment: "account.type.investment",
};

// Carte compacte dans la colonne latérale de Saisie : voir d'un coup d'œil
// le solde de chaque compte (courant/épargne/...) sans devoir aller sur
// Profil. Composant serveur pur (pas de 'use client') — se contente
// d'afficher les soldes déjà chargés par app/saisie/page.tsx ; un
// router.refresh() après une saisie ou un virement (déjà en place dans
// TransactionForm/TransferCard) suffit à le tenir à jour, pas besoin de
// fetch client dédié. Liste verticale (plutôt que des pastilles horizontales)
// pour rester lisible dans une colonne étroite, à côté de TransferCard.
export default function AccountBalancesBanner({
  accounts,
  locale,
}: {
  accounts: AccountBalance[];
  locale: Locale;
}) {
  if (accounts.length < 2) return null;

  return (
    <div className="p-6 border bg-surface rounded-2xl border-line space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl border bg-copper/10 border-copper/25">
          <Wallet className="w-5 h-5 text-copper" />
        </div>
        <h2 className="text-sm font-black tracking-tight uppercase text-ink">
          {t(locale, "common.accounts")}
        </h2>
      </div>
      <div className="space-y-2">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-alt/50 border border-line/50"
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-body-soft truncate">
                {account.name}
              </p>
              <p className="text-[10px] text-faint mt-0.5">
                {t(locale, TYPE_KEY[account.type] ?? account.type)}
              </p>
            </div>
            <p className="text-sm font-bold text-ink tabular-nums whitespace-nowrap">
              {account.balance.toLocaleString("fr-FR", {
                maximumFractionDigits: 2,
              })}{" "}
              {account.currency}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
