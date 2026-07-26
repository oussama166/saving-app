import React from 'react';
import PortfolioTabs from '../components/PortfolioTabs';
import { prisma } from '@/lib/prisma';
import { getEnrichedPortfolioAssets } from '@/lib/portfolio';
import { getAverageMonthlyExpenses, getEmergencyFundBalance, getUserSettings } from '@/lib/financials';
import { requireSession } from '@/lib/auth';
import { getHouseholdContext } from '@/lib/household';
import { getRatesToMad } from '@/lib/exchangeRates';
import { getFeatureStatusForUser } from '@/lib/features';
import FeatureDisabledNotice from '@/app/components/FeatureDisabledNotice';

export const dynamic = 'force-dynamic';

export default async function PortfolioPage() {
  const { userId } = await requireSession();
  const featureStatus = await getFeatureStatusForUser('portfolio', userId);
  if (!featureStatus.allowed) {
    return <FeatureDisabledNotice featureName="Portfolio & Épargne" message={featureStatus.message} />;
  }
  const ctx = await getHouseholdContext(userId);
  const [accounts, portfolio, { referenceIncome, emergencyFundTargetMonths }, emergencyFundBalance] =
    await Promise.all([
      prisma.account.findMany({ where: { userId: { in: ctx.memberIds } }, orderBy: { name: 'asc' } }),
      getEnrichedPortfolioAssets(ctx),
      getUserSettings(ctx),
      getEmergencyFundBalance(ctx),
    ]);

  const avgMonthlyExpenses = await getAverageMonthlyExpenses(ctx, referenceIncome);
  const emergencyFundTarget = emergencyFundTargetMonths * avgMonthlyExpenses;
  const emergencyFundMonthsCovered = avgMonthlyExpenses > 0 ? emergencyFundBalance / avgMonthlyExpenses : 0;

  const fxRates = await getRatesToMad(accounts.map((a) => a.currency));
  const totalChecking = accounts
    .filter((a) => a.type === 'checking')
    .reduce((acc, a) => acc + a.balance * (fxRates[a.currency] ?? 1), 0);

  const valueByAssetType = (types: string[]) =>
    portfolio.enrichedAssets.filter((a) => types.includes(a.assetType)).reduce((acc, a) => acc + a.liveValue, 0);

  const cryptoValue = valueByAssetType(['Crypto']);
  const stocksEtfValue = valueByAssetType(['Action', 'ETF']);
  const otherAssetsValue = valueByAssetType(['OPCVM', 'Or']);

  const allocationRaw = [
    { name: 'Compte Courant', value: totalChecking, color: '#94a3b8' },
    { name: "Fonds d'Urgence", value: Math.max(emergencyFundBalance, 0), color: '#10b981' },
    { name: 'Crypto', value: cryptoValue, color: '#f87171' },
    { name: 'Actions & ETF', value: stocksEtfValue, color: '#3b82f6' },
    { name: 'Autres (OPCVM/Or)', value: otherAssetsValue, color: '#fbbf24' },
  ].filter((slice) => slice.value > 0);

  const allocationTotal = allocationRaw.reduce((acc, s) => acc + s.value, 0);
  const allocationData = allocationRaw.map((slice) => ({
    name: slice.name,
    color: slice.color,
    value: allocationTotal > 0 ? Math.round((slice.value / allocationTotal) * 100) : 0,
  }));

  return (
    <main className="min-h-screen bg-page p-4 sm:p-6 lg:p-8 text-body font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Portfolio & Épargne</h1>
          <p className="text-subtle text-sm mt-1">
            Vue globale de vos actifs et liquidités. Mise à jour en temps réel.
          </p>
        </header>

        <PortfolioTabs
          emergencyFundBalance={emergencyFundBalance}
          emergencyFundTarget={emergencyFundTarget}
          emergencyFundTargetMonths={emergencyFundTargetMonths}
          emergencyFundMonthsCovered={emergencyFundMonthsCovered}
          avgMonthlyExpenses={avgMonthlyExpenses}
          assets={portfolio.enrichedAssets}
          globalLiveValue={portfolio.globalLiveValue}
          globalCostBasis={portfolio.globalCostBasis}
          globalProfit={portfolio.globalProfit}
          accounts={accounts}
          allocationData={allocationData}
        />
      </div>
    </main>
  );
}
