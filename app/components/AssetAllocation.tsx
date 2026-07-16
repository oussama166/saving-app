'use client';

import React from 'react';
import { PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export interface AllocationSlice {
  name: string;
  value: number; // %
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number }[];
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-page border border-line text-body p-2 rounded-lg shadow-xl">
        <p className="text-xs font-bold">{`${payload[0].name}: ${payload[0].value}%`}</p>
      </div>
    );
  }
  return null;
};

export default function AssetAllocation({ data }: { data: AllocationSlice[] }) {
  const hasData = data.some((d) => d.value > 0);

  return (
    <div className="bg-surface rounded-xl border border-line p-6">
      <div className="flex items-center gap-3 mb-6">
        <PieChartIcon className="w-6 h-6 text-blue-400" />
        <h3 className="text-lg font-bold text-body">Répartition du Patrimoine</h3>
      </div>

      {hasData ? (
        <>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            {data.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
                  {item.name} ({item.value}%)
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="h-[300px] flex items-center justify-center text-subtle text-sm italic">
          Aucun actif ou compte à répartir pour le moment.
        </div>
      )}
    </div>
  );
}
