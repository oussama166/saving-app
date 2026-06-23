"use client";

interface Transaction {
  id: string;
  date: string | Date;
  amount: number;
  merchant: string;
  subCategory?: string | null;
  paymentMethod?: string | null;
  category: {
    name: string;
    type: "income" | "expense" | "savings";
  };
  account: {
    name: string;
  };
}

export default function HistoryTable({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const formatMAD = (amt: number) =>
    new Intl.NumberFormat("fr-MA", {
      style: "currency",
      currency: "MAD",
    }).format(amt);

  const formatDate = (date: string | Date) =>
    new Date(date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  return (
    <div className="bg-[#1b253b] rounded-xl border border-slate-700 overflow-hidden shadow-2xl">
      <div className="p-5 border-b border-slate-800 flex justify-between items-center">
        <h2 className="text-sm font-bold uppercase tracking-widest text-white">
          Historique Complet
        </h2>
        <span className="text-[10px] bg-slate-800 text-slate-500 px-2 py-1 rounded font-bold">
          {transactions.length} ENREGISTREMENTS
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px]">
          <thead>
            <tr className="text-slate-500 bg-slate-900/50">
              <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">
                Date
              </th>
              <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">
                Sens
              </th>
              <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">
                Catégorie
              </th>
              <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">
                Sous-Catégorie
              </th>
              <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">
                Méthode
              </th>
              <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800">
                Description
              </th>
              <th className="py-3 px-5 font-bold uppercase tracking-wider border-b border-slate-800 text-right">
                Montant
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {transactions.map((tx) => {
              return (
                <tr
                  key={tx.id}
                  className="hover:bg-slate-800/30 transition-colors group"
                >
                  <td className="py-3 px-5 text-slate-400 font-medium">
                    {formatDate(tx.date)}
                  </td>
                  <td className="py-3 px-5">
                    {tx.category?.type == "income" ? (
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold uppercase">
                        Revenu
                      </span>
                    ) : tx.category?.type != "income" ? (
                      <span className="text-[9px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded border border-red-500/20 font-bold uppercase">
                        Dépense
                      </span>
                    ) : (
                      <span className="text-[9px] bg-red-500/10 teqxt-red-500 px-1.5 py-0.5 rounded border border-red-500/20 font-bold uppercase">
                        Épargne/Invest.
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-5">
                    <span className="text-slate-200 font-bold">
                      {tx.category.name}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-slate-400">
                    {tx.subCategory || "-"}
                  </td>
                  <td className="py-3 px-5 text-slate-400">
                    {tx.paymentMethod || "-"}
                  </td>
                  <td className="py-3 px-5 text-slate-300 max-w-xs truncate">
                    {tx.merchant}
                  </td>
                  <td
                    className={`py-3 px-5 text-right font-black ${tx.amount > 0 ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {tx.amount > 0 ? "+" : ""}
                    {formatMAD(tx.amount)}
                  </td>
                </tr>
              );
            })}
            {transactions.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="py-20 text-center text-slate-500 italic"
                >
                  Aucune transaction trouvée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
