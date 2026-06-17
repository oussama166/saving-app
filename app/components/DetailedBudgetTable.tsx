'use client';

interface BudgetDetail {
  categoryName: string;
  allocationPct: number;
  budgetedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  usedPct: number;
}

export default function DetailedBudgetTable({ details }: { details: BudgetDetail[] }) {
  const formatMAD = (amt: number) => 
    new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amt);

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Detailed Budget</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-slate-500 border-b border-slate-700/50">
              <th className="p-4 font-semibold">CATÉGORIE</th>
              <th className="p-4 font-semibold text-center">ALLOC. %</th>
              <th className="p-4 font-semibold">BUDGET (DH)</th>
              <th className="p-4 font-semibold">DÉPENSÉ (DH)</th>
              <th className="p-4 font-semibold">RESTE (DH)</th>
              <th className="p-4 font-semibold w-32">% UTILISÉ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {details.map((row, i) => (
              <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                <td className="p-4 font-bold text-slate-200">{row.categoryName}</td>
                <td className="p-4 text-center text-slate-400">{row.allocationPct}%</td>
                <td className="p-4 text-slate-300 font-medium">{formatMAD(row.budgetedAmount)}</td>
                <td className="p-4 text-slate-300 font-medium">{formatMAD(row.spentAmount)}</td>
                <td className={`p-4 font-bold ${row.remainingAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatMAD(row.remainingAmount)}
                </td>
                <td className="p-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center px-0.5">
                      <span className="text-[10px] text-slate-500 font-bold">{row.usedPct}%</span>
                    </div>
                    <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${row.usedPct > 90 ? 'bg-red-500' : 'bg-blue-500'}`} 
                        style={{ width: `${Math.min(row.usedPct, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
