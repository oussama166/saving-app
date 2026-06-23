import React from 'react';
import EmergencyFundCard from '../components/EmergencyFundCard';
import AssetAllocation from '../components/AssetAllocation';
import { Wallet, ArrowUpRight, Landmark, Coins } from 'lucide-react';

const DUMMY_ACCOUNTS = [
  { id: 1, name: 'BMCE - Compte Courant', balance: 12500, type: 'Checking', icon: Wallet },
  { id: 2, name: 'CIH - Épargne', balance: 45000, type: 'Savings', icon: Landmark },
  { id: 3, name: 'Binance - Crypto', balance: 8200, type: 'Investment', icon: Coins },
  { id: 4, name: 'Bourse de Casa', balance: 32000, type: 'Investment', icon: ArrowUpRight },
];

export default function PortfolioPage() {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-MA', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 0,
    }).format(amount).replace('MAD', 'DH');
  };

  return (
    <main className="min-h-screen bg-[#131b2c] p-8 text-slate-200 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-white">Portfolio & Épargne</h1>
          <p className="text-slate-500 text-sm mt-1">
            Vue globale de vos actifs et liquidités. Mise à jour en temps réel.
          </p>
        </header>

        {/* Top Grid: Fund & Allocation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <EmergencyFundCard targetAmount={60000} currentAmount={24500} />
          <AssetAllocation />
        </div>

        {/* Connected Accounts Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
            <h2 className="text-xl font-bold tracking-tight text-white">Comptes Connectés</h2>
          </div>

          <div className="bg-[#1b253b] rounded-xl border border-slate-700 overflow-hidden">
            <div className="divide-y divide-slate-800">
              {DUMMY_ACCOUNTS.map((account) => (
                <div 
                  key={account.id} 
                  className="flex items-center justify-between p-5 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700">
                      <account.icon className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-200">{account.name}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                        {account.type}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-mono font-bold text-slate-200">
                      {formatCurrency(account.balance)}
                    </p>
                    <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                      Actif
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
