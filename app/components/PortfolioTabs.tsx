'use client';

import { useState } from 'react';
import { ShieldCheck, Briefcase, Wallet, Landmark, Coins } from 'lucide-react';
import EmergencyFundCard from './EmergencyFundCard';
import EmergencyFundStrategy from './EmergencyFundStrategy';
import AssetAllocation, { AllocationSlice } from './AssetAllocation';
import PortfolioAssetsTable, { EnrichedPortfolioAsset } from './PortfolioAssetsTable';

interface AccountRow {
  id: string;
  name: string;
  type: string;
  balance: number;
}

const ACCOUNT_TYPE_META: Record<string, { label: string; icon: typeof Wallet }> = {
  checking: { label: 'Compte Courant', icon: Wallet },
  savings: { label: 'Épargne', icon: Landmark },
  investment: { label: 'Investissement', icon: Coins },
};

interface Props {
  emergencyFundBalance: number;
  emergencyFundTarget: number;
  emergencyFundTargetMonths: number;
  emergencyFundMonthsCovered: number;
  avgMonthlyExpenses: number;
  assets: EnrichedPortfolioAsset[];
  globalLiveValue: number;
  globalCostBasis: number;
  globalProfit: number;
  accounts: AccountRow[];
  allocationData: AllocationSlice[];
}

export default function PortfolioTabs({
  emergencyFundBalance,
  emergencyFundTarget,
  emergencyFundTargetMonths,
  emergencyFundMonthsCovered,
  avgMonthlyExpenses,
  assets,
  globalLiveValue,
  globalCostBasis,
  globalProfit,
  accounts,
  allocationData,
}: Props) {
  const formatDH = (amt: number) =>
    new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amt).replace('MAD', 'DH');

  const [tab, setTab] = useState<'fund' | 'portfolio'>('fund');

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-line-subtle">
        <button
          onClick={() => setTab('fund')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${
            tab === 'fund'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-subtle hover:text-body-soft'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Fonds d&apos;Urgence
        </button>
        <button
          onClick={() => setTab('portfolio')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${
            tab === 'portfolio'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-subtle hover:text-body-soft'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Portfolio
        </button>
      </div>

      {tab === 'fund' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EmergencyFundCard
              currentAmount={emergencyFundBalance}
              targetAmount={emergencyFundTarget}
              monthsCovered={emergencyFundMonthsCovered}
              targetMonths={emergencyFundTargetMonths}
            />
            <EmergencyFundStrategy
              emergencyFundBalance={emergencyFundBalance}
              emergencyFundTarget={emergencyFundTarget}
              emergencyFundTargetMonths={emergencyFundTargetMonths}
              monthsCovered={emergencyFundMonthsCovered}
              avgMonthlyExpenses={avgMonthlyExpenses}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AssetAllocation data={allocationData} />

            <div className="bg-surface rounded-xl border border-line overflow-hidden">
              <div className="p-5 border-b border-line-subtle">
                <h3 className="text-sm font-bold uppercase tracking-widest text-ink">Comptes</h3>
              </div>
              <div className="divide-y divide-line-subtle">
                {accounts.map((account) => {
                  const meta = ACCOUNT_TYPE_META[account.type] ?? { label: account.type, icon: Wallet };
                  const Icon = meta.icon;
                  return (
                    <div key={account.id} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-surface-alt p-2 rounded-lg border border-line">
                          <Icon className="w-4 h-4 text-muted" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-body">{account.name}</p>
                          <p className="text-[10px] font-bold text-subtle uppercase tracking-widest">
                            {meta.label}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-mono font-bold text-body">{formatDH(account.balance)}</p>
                    </div>
                  );
                })}
                {accounts.length === 0 && (
                  <div className="p-8 text-center text-subtle text-sm italic">Aucun compte trouvé.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <PortfolioAssetsTable
          assets={assets}
          globalLiveValue={globalLiveValue}
          globalCostBasis={globalCostBasis}
          globalProfit={globalProfit}
        />
      )}
    </div>
  );
}
