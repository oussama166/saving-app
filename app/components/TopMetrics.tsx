"use client";

import { TrendingUp, ShieldCheck, Briefcase, Activity } from "lucide-react";
import { useLanguage } from "./LanguageProvider";

interface TopMetricsProps {
  metrics: {
    cashFlow: number;
    emergencyFundMonths: number;
    portfolioValue: number;
    healthScore: number;
  };
}

export default function TopMetrics({ metrics }: TopMetricsProps) {
  const { t, locale } = useLanguage();
  const formatCUR = (amt: number) =>
    new Intl.NumberFormat(`${locale}-MA`, {
      style: "currency",
      currency: "MAD",
    }).format(amt);

  const cards = [
    {
      title: t("dashboard.minicard.cashflow"),
      value: formatCUR(metrics.cashFlow),
      icon: <TrendingUp className="w-4 h-4 text-green-400" />,
      color: "text-green-400",
      desc: t("dashboard.minicard.cashflow.sub"),
    },
    {
      title: t("dashboard.minicard.emergency"),
      value: `${metrics.emergencyFundMonths} ${t("common.month")}`,
      icon: <ShieldCheck className="w-4 h-4 text-yellow-400" />,
      color: "text-yellow-400",
      desc: t("dashboard.minicard.emergency.sub"),
    },
    {
      title: t("dashboard.minicard.portfolio"),
      value: formatCUR(metrics.portfolioValue),
      icon: <Briefcase className="w-4 h-4 text-blue-400" />,
      color: "text-blue-400",
      desc: t("dashboard.minicard.portfolio.sub"),
    },
    {
      title: t("dashboard.minicard.healthScore"),
      value: `${metrics.healthScore}/100`,
      icon: <Activity className="w-4 h-4 text-orange-400" />,
      color: "text-orange-400",
      desc: t("dashboard.minicard.healthScore.sub"),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <div
          key={i}
          className="bg-surface-alt/50 border border-line p-5 rounded-2xl flex flex-col justify-between"
        >
          <div className="flex justify-between items-start">
            <span className="text-muted text-xs font-semibold uppercase tracking-wider truncate">
              {card.title}
            </span>
            {card.icon}
          </div>
          <div className="mt-4">
            <p className={`text-2xl font-bold ${card.color} truncate`}>
              {card.value}
            </p>
            <p className="text-[10px] text-subtle font-medium mt-1">
              {card.desc}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
