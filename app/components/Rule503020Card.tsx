'use client';

interface RuleItem {
  amount: number;
  pct: number;
}

interface Rule503020Props {
  rule: {
    needs: RuleItem;
    wants: RuleItem;
    savings: RuleItem;
  };
}

export default function Rule503020Card({ rule }: Rule503020Props) {
  const items = [
    { label: 'Needs (50%)', actual: rule.needs.pct, target: 50, color: 'bg-blue-500', dot: 'bg-blue-500' },
    { label: 'Wants (30%)', actual: rule.wants.pct, target: 30, color: 'bg-purple-500', dot: 'bg-purple-500' },
    { label: 'Savings (20%)', actual: rule.savings.pct, target: 20, color: 'bg-green-500', dot: 'bg-green-500' },
  ];

  return (
    <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">50/30/20 Rule</h3>
        <span className="text-[10px] bg-slate-700 text-slate-400 px-2 py-1 rounded uppercase font-bold">Actual Split</span>
      </div>
      
      <div className="space-y-6">
        {items.map((item, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${item.dot}`} />
                <span className="text-xs font-semibold text-slate-300">{item.label}</span>
              </div>
              <span className={`text-xs font-bold ${item.actual > item.target && item.label !== 'Savings (20%)' ? 'text-red-400' : 'text-slate-400'}`}>
                {item.actual}%
              </span>
            </div>
            <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-700 ${item.color}`} 
                style={{ width: `${Math.min(item.actual, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
              <span>0%</span>
              <span>Target: {item.target}%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
        <p className="text-[10px] text-slate-500 leading-relaxed italic">
          Ideal split: 50% Essentials, 30% Lifestyle, 20% Financial Goals.
        </p>
      </div>
    </div>
  );
}
