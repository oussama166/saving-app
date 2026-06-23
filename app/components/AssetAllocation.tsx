'use client';

import React from 'react';
import { PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const DATA = [
  { name: 'Compte Courant', value: 30, color: '#94a3b8' },
  { name: "Fonds d'Urgence", value: 20, color: '#10b981' },
  { name: 'Crypto', value: 10, color: '#f87171' },
  { name: 'Actions/ETF', value: 40, color: '#3b82f6' },
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#131b2c] border border-slate-700 text-slate-200 p-2 rounded-lg shadow-xl">
        <p className="text-xs font-bold">{`${payload[0].name}: ${payload[0].value}%`}</p>
      </div>
    );
  }
  return null;
};

export default function AssetAllocation() {
  return (
    <div className="bg-[#1b253b] rounded-xl border border-slate-700 p-6">
      <div className="flex items-center gap-3 mb-6">
        <PieChartIcon className="w-6 h-6 text-blue-400" />
        <h3 className="text-lg font-bold text-slate-200">Répartition du Patrimoine</h3>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={DATA}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
            >
              {DATA.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        {DATA.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: item.color }} 
            />
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              {item.name} ({item.value}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
