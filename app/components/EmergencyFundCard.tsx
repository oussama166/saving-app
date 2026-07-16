'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface EmergencyFundCardProps {
  currentAmount: number;
  targetAmount: number;
  monthsCovered: number;
  targetMonths: number;
}

export default function EmergencyFundCard({
  currentAmount,
  targetAmount,
  monthsCovered,
  targetMonths,
}: EmergencyFundCardProps) {
  const percentage = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-MA', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 0,
    }).format(amount).replace('MAD', 'DH');
  };

  return (
    <div className="bg-surface rounded-xl border border-line p-6 h-full flex flex-col justify-between">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
          <h3 className="text-lg font-bold text-body">Fonds d&apos;Urgence (Sécurité)</h3>
        </div>

        <div className="pt-4">
          <div className="flex justify-between items-end mb-2">
            <span className="text-3xl font-bold text-body">
              {formatCurrency(currentAmount)}
            </span>
            <span className="text-subtle font-medium text-sm mb-1">
              Objectif: {formatCurrency(targetAmount)}
            </span>
          </div>

          <div className="bg-page rounded-full h-4 w-full overflow-hidden border border-line-subtle">
            <div
              className="bg-emerald-500 h-full transition-all duration-1000 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
          
          <p className="text-right text-xs font-bold text-emerald-400 mt-2 uppercase tracking-wider">
            {percentage.toFixed(1)}% complété
          </p>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
        <p className="text-[11px] text-muted leading-relaxed">
          Votre fonds d&apos;urgence couvre actuellement environ{' '}
          <span className="text-emerald-400 font-bold">{monthsCovered.toFixed(1)} mois</span> de
          dépenses essentielles. Continuez ainsi pour atteindre votre objectif de {targetMonths} mois.
        </p>
      </div>
    </div>
  );
}
