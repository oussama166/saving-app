"use client";

import { Clock, Send, CheckCircle2, FileText } from "lucide-react";
import type { MedicalRecordRow } from "./MedicalRecordsTable";
import { useLanguage } from "./LanguageProvider";

interface Props {
  records: MedicalRecordRow[];
}

export default function ReimbursementSummary({ records }: Props) {
  const byStatus = (status: string) =>
    records.filter((r) => r.reimbursementStatus === status);
  const { t, locale } = useLanguage();
  const formatCUR = (val: number) =>
    new Intl.NumberFormat(`${locale}-MA`, {
      style: "currency",
      currency: "MAD",
      maximumFractionDigits: 0,
    }).format(val);

  const pending = byStatus("PENDING");
  const submitted = byStatus("SUBMITTED");
  const reimbursed = byStatus("REIMBURSED");

  const sum = (rows: MedicalRecordRow[]) =>
    rows.reduce((acc, r) => acc + r.amount, 0);

  const rows = [
    {
      label: t("health.card2.sub_waiting"),
      count: pending.length,
      amount: sum(pending),
      icon: Clock,
      color: "text-orange-400",
      bg: "bg-orange-500/10 border-orange-500/20",
    },
    {
      label: t("health.card2.sub_cnss"),
      count: submitted.length,
      amount: sum(submitted),
      icon: Send,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
    },
    {
      label: t("health.card2.sub_reimbursed"),
      count: reimbursed.length,
      amount: sum(reimbursed),
      icon: CheckCircle2,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
  ];

  return (
    <div className="h-full p-6 space-y-4 border shadow-2xl bg-surface rounded-2xl border-line">
      <div className="flex items-center gap-3">
        <FileText className="w-5 h-5 text-rose-400" />
        <h3 className="text-sm font-bold tracking-widest uppercase text-ink">
          {t("health.card2.title")}
        </h3>
      </div>

      <div className="space-y-3">
        {rows.map((r) => (
          <div
            key={r.label}
            className={`p-3 rounded-xl border ${r.bg} flex items-center justify-between`}
          >
            <div className="flex items-center gap-2">
              <r.icon className={`w-4 h-4 ${r.color}`} />
              <span className="text-[11px] font-bold text-body-soft">
                {r.label} <span className="text-subtle">({r.count})</span>
              </span>
            </div>
            <p className={`text-sm font-black ${r.color}`}>
              {formatCUR(r.amount)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
