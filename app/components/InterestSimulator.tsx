'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

// FV = PMT * (((1 + r)^n - 1) / r) — même formule que le simulateur interactif
function futureValue(monthlyAmount: number, annualRatePct: number, years: number) {
  const monthlyRate = annualRatePct / 100 / 12;
  const months = years * 12;
  return monthlyAmount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
}

const RISK_PROFILES = [
  { emoji: '🟢', label: 'Conservateur', rate: 4, color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' },
  { emoji: '🔵', label: 'Modéré', rate: 7, color: 'text-blue-400 border-blue-500/20 bg-blue-500/5' },
  { emoji: '🟡', label: 'Optimiste', rate: 10, color: 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5' },
  { emoji: '🔴', label: 'Agressif', rate: 15, color: 'text-red-400 border-red-500/20 bg-red-500/5' },
];

interface InterestSimulatorProps {
  showChart?: boolean;
}

export default function InterestSimulator({ showChart = true }: InterestSimulatorProps) {
  const [dca, setDca] = useState(1500);
  const [horizon, setHorizon] = useState(10);
  const [yieldRate, setYieldRate] = useState(7);

  const data = useMemo(() => {
    const points = [];
    const monthlyRate = yieldRate / 100 / 12;

    for (let year = 0; year <= horizon; year++) {
      const months = year * 12;
      // FV = PMT * (((1 + r)^n - 1) / r)
      const fv = dca * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
      const invested = dca * months;

      points.push({
        year: `An ${year}`,
        total: Math.round(year === 0 ? 0 : fv),
        invested: invested,
        interest: Math.round(year === 0 ? 0 : fv - invested)
      });
    }
    return points;
  }, [dca, horizon, yieldRate]);

  // Scénarios de référence dynamiques : recalculés à partir du DCA et de
  // l'horizon actuellement réglés sur les sliders (plus des montants fixes
  // arbitraires), pour chacun des 4 profils de risque, plus une variante
  // long terme (horizon x2, plafonné à 40 ans) pour comparer.
  const referenceScenarios = useMemo(() => {
    const longHorizon = Math.min(horizon * 2, 40);
    const base = RISK_PROFILES.map((p) => ({
      ...p,
      years: horizon,
      value: futureValue(dca, p.rate, horizon),
    }));
    const longTerm =
      longHorizon > horizon
        ? RISK_PROFILES.filter((p) => p.label === 'Modéré' || p.label === 'Optimiste').map((p) => ({
            ...p,
            label: `${p.label} (${longHorizon} ans)`,
            years: longHorizon,
            value: futureValue(dca, p.rate, longHorizon),
          }))
        : [];
    return [...base, ...longTerm];
  }, [dca, horizon]);

  const finalData = data[data.length - 1];
  const formatCUR = (val: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="bg-surface rounded-2xl border border-line p-8 shadow-2xl">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-xl font-bold text-ink tracking-tight">Interest Simulator</h2>
        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded uppercase font-bold tracking-widest border border-blue-500/20">Pro Projection</span>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <div className="bg-surface-deep/50 p-4 rounded-xl border border-line/50">
          <span className="text-[10px] text-subtle font-bold uppercase tracking-widest">Capital Investi</span>
          <p className="text-xl font-bold text-body-soft mt-1">{formatCUR(finalData.invested)}</p>
        </div>
        <div className="bg-surface-deep/50 p-4 rounded-xl border border-line/50">
          <span className="text-[10px] text-subtle font-bold uppercase tracking-widest">Intérêts Composés</span>
          <p className="text-xl font-bold text-green-400 mt-1">+{formatCUR(finalData.interest)}</p>
        </div>
        <div className="bg-blue-600/10 p-4 rounded-xl border border-blue-500/20">
          <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Capital Final</span>
          <p className="text-2xl font-black text-blue-400 mt-1">{formatCUR(finalData.total)}</p>
        </div>
      </div>

      {/* Chart Area */}
      {showChart && (
        <div className="h-[300px] mb-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis
                dataKey="year"
                axisLine={false}
                tickLine={false}
                tick={{fill: '#64748b', fontSize: 10}}
                interval={Math.floor(horizon / 5)}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                itemStyle={{ color: '#f1f5f9' }}
                formatter={(value: number) => formatCUR(value)}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#3b82f6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorTotal)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Sliders Area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">DCA Mensuel</label>
            <span className="text-sm font-bold text-ink">{formatCUR(dca)}</span>
          </div>
          <input
            type="range" min="100" max="10000" step="100"
            value={dca} onChange={(e) => setDca(parseInt(e.target.value))}
            className="w-full h-1.5 bg-surface-strong rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">Horizon (Années)</label>
            <span className="text-sm font-bold text-ink">{horizon} ans</span>
          </div>
          <input
            type="range" min="1" max="40" step="1"
            value={horizon} onChange={(e) => setHorizon(parseInt(e.target.value))}
            className="w-full h-1.5 bg-surface-strong rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">Rendement Annuel</label>
            <span className="text-sm font-bold text-ink">{yieldRate}%</span>
          </div>
          <input
            type="range" min="1" max="20" step="1"
            value={yieldRate} onChange={(e) => setYieldRate(parseInt(e.target.value))}
            className="w-full h-1.5 bg-surface-strong rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
      </div>

      {/* Scénarios de référence — dynamiques, basés sur le DCA/horizon réglés ci-dessus */}
      <div className="mt-10 pt-8 border-t border-line-subtle">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted mb-4">Scénarios de Référence</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {referenceScenarios.map((s) => (
            <div key={s.label} className={`p-4 rounded-xl border ${s.color}`}>
              <p className="text-xs font-bold uppercase tracking-widest mb-1">
                {s.emoji} {s.label} ({formatCUR(dca)}/m à {s.rate}%, {s.years} ans)
              </p>
              <p className="text-lg font-black text-ink">{formatCUR(s.value)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
