"use client";

import { useState, useEffect } from "react";
import TopMetrics from "./components/TopMetrics";
import DetailedBudgetTable from "./components/DetailedBudgetTable";
import Rule503020Card from "./components/Rule503020Card";
import Visualizations from "./components/Visualizations";
import FinanceAgent from "./components/FinanceAgent";
import InterestSimulator from "./components/InterestSimulator";
import { Bell } from "lucide-react";
import { useLanguage } from "./components/LanguageProvider";
import FeatureGate from "./components/FeatureGate";

function getInitials(name: string | null, email: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (email) return email.charAt(0).toUpperCase();
  return "U";
}

interface DashboardData {
  metrics: {
    cashFlow: number;
    emergencyFundMonths: number;
    portfolioValue: number;
    healthScore: number;
  };
  budgetDetails: {
    categoryName: string;
    allocationPct: number;
    budgetedAmount: number;
    spentAmount: number;
    remainingAmount: number;
    usedPct: number;
  }[];
  rule503020: {
    needs: { amount: number; pct: number };
    wants: { amount: number; pct: number };
    savings: { amount: number; pct: number };
  };
  chartData: {
    expensesByCategory: { name: string; value: number }[];
    budgetVsActual: { category: string; budget: number; actual: number }[];
  };
  safeToSpend: number;
}

export default function Dashboard() {
  return (
    <FeatureGate featureKey="dashboard" featureName="Dashboard">
      <DashboardContent />
    </FeatureGate>
  );
}

function DashboardContent() {
  const { t, locale } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setUserName(result.user.name ?? null);
          setUserEmail(result.user.email ?? null);
        }
      })
      .catch(() => {});
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/dashboard");
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      } else {
        console.error("API Error:", result.error);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Différé en microtask (voir react-hooks/set-state-in-effect) : évite
    // que l'appel synchrone à fetchData() dans le corps de l'effet soit
    // traité comme un setState direct par la règle de lint, même si
    // l'écriture d'état réelle n'arrive qu'après le fetch (asynchrone).
    Promise.resolve().then(() => {
      fetchData();
    });

    // SSE for real-time updates
    const eventSource = new EventSource("/api/events");
    eventSource.onmessage = (event: MessageEvent) => {
      if (event.data === "refresh") {
        console.log("[SSE] Refresh event received");
        fetchData();
      }
    };

    const interval = setInterval(fetchData, 60000);
    return () => {
      clearInterval(interval);
      eventSource.close();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-page">
        <div className="w-12 h-12 border-b-2 border-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!data) return null;

  const { metrics, budgetDetails, rule503020, chartData, safeToSpend } = data;

  return (
    <main className="min-h-screen p-4 font-sans sm:p-6 bg-page text-body">
      <div className="mx-auto space-y-8 max-w-7xl">
        <header className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              {t("dashboard.title")}
            </h1>

            {locale != "ar" ? (
              <p className="mt-1 text-sm text-subtle">
                {t("dashboard.welcome")}{" "}
                <span className="font-bold text-orange-400">
                  {metrics.healthScore}%
                </span>
                .
              </p>
            ) : (
              <p className="mt-1 text-sm text-subtle">
                <span className="font-bold text-orange-400">
                  . {metrics.healthScore}%
                </span>{" "}
                {t("dashboard.welcome")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-6 p-3 border bg-surface-alt/40 rounded-2xl border-line/50">
            <div className="text-right">
              <span className="text-[10px] font-bold text-subtle uppercase tracking-widest">
                {t("dashboard.globalSafeBalance")}
              </span>
              <p className="font-mono text-xl font-bold text-green-400">
                {new Intl.NumberFormat(`${locale}-MA`, {
                  style: "currency",
                  currency: "MAD",
                }).format(safeToSpend)}
              </p>
            </div>
            <div
              className="flex items-center justify-center w-10 h-10 border rounded-full bg-surface-strong border-line-strong"
              title={userName || userEmail || undefined}
            >
              <span className="text-xs font-bold text-body-soft">
                {getInitials(userName, userEmail)}
              </span>
            </div>
          </div>
        </header>

        <TopMetrics metrics={metrics} />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DetailedBudgetTable details={budgetDetails} />
          </div>
          <div className="space-y-8">
            <Rule503020Card rule={rule503020} />
            <div className="p-6 border bg-surface-alt/50 border-line rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-4 h-4 text-orange-400" />
                <h3 className="text-sm font-bold tracking-widest uppercase text-muted">
                  {t("dashboard.smartAlerts")}
                </h3>
              </div>
              <div className="space-y-3">
                {budgetDetails.some((b) => b.usedPct > 90) ? (
                  <div className="p-3 border bg-red-500/10 border-red-500/20 rounded-xl">
                    <p className="text-[11px] text-red-400 font-medium">
                      {t("dashboard.budgetExceeded")}
                    </p>
                  </div>
                ) : (
                  <div className="p-3 border bg-green-500/10 border-green-500/20 rounded-xl">
                    <p className="text-[11px] text-green-400 font-medium">
                      {t("dashboard.systemNominal")}
                    </p>
                  </div>
                )}
                <div className="p-3 border bg-blue-500/10 border-blue-500/20 rounded-xl">
                  <p className="text-[11px] text-blue-400 font-medium">
                    {t("dashboard.portfolioAdvice")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Visualizations data={chartData} />

        {/* Wealth OS Tools */}
        <section className="pt-8 border-t border-line-subtle">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
            <h2 className="text-2xl font-bold tracking-tight text-ink">
              {t("dashboard.wealthTools")}
            </h2>
          </div>
          <InterestSimulator />
        </section>
      </div>
      <FinanceAgent />
    </main>
  );
}
