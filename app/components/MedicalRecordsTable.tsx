"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Stethoscope, PlusCircle, Check, FileCheck2 } from "lucide-react";
import { useLanguage } from "./LanguageProvider";

export interface MedicalRecordRow {
  id: string;
  provider: string;
  amount: number;
  date: string;
  reimbursementStatus: string;
  transaction: { id: string; merchant: string; amount: number } | null;
}

const EMPTY_FORM = {
  provider: "",
  amount: "",
  date: new Date().toISOString().slice(0, 10),
  linkTransaction: true,
};

export default function MedicalRecordsTable({
  records,
}: {
  records: MedicalRecordRow[];
}) {

  const router = useRouter();
  const { t ,locale} = useLanguage();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const STATUS_FLOW = ["PENDING", "SUBMITTED", "REIMBURSED"] as const;

  const STATUS_META: Record<
    string,
    { label: string; color: string; nextLabel: string }
  > = {
    PENDING: {
      label: `${t("health.card5.table.status.pending")}`,
      color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
      nextLabel: `${t("health.card5.table.status.pending.next")}`,
    },
    SUBMITTED: {
      label: `${t("health.card5.table.status.submited")}`,
      color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
      nextLabel: `${t("health.card5.table.status.submited.next")}`,
    },
    REIMBURSED: {
      label: `${t("health.card5.table.status.reimbursed")}`,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      nextLabel: "",
    },
  };

  const formatDH = (amt: number) =>
    new Intl.NumberFormat(`${locale}-MA`, { style: "currency", currency: "MAD" })
      .format(amt)
      .replace("MAD", "DH");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: form.provider,
          amount: form.amount,
          date: form.date,
          linkTransaction: form.linkTransaction,
        }),
      });
      if (res.ok) {
        setForm(EMPTY_FORM);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCnssUpdate = async (record: MedicalRecordRow) => {
    const currentIdx = STATUS_FLOW.indexOf(
      record.reimbursementStatus as (typeof STATUS_FLOW)[number],
    );
    const next = STATUS_FLOW[currentIdx + 1];
    if (!next) return;

    setUpdatingId(record.id);
    try {
      await fetch(`/api/health/${record.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reimbursementStatus: next }),
      });
      router.refresh();
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="overflow-hidden border bg-surface rounded-xl border-line">
        <div className="flex items-center gap-2 p-5 border-b border-line-subtle">
          <Stethoscope className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm font-bold tracking-widest uppercase text-ink">
            {t("health.card5.title")}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="text-subtle bg-surface-deep/50">
                <th className="px-5 py-3 font-bold tracking-wider uppercase border-b border-line-subtle">
                  {t("health.card5.table.date")}
                </th>
                <th className="px-5 py-3 font-bold tracking-wider uppercase border-b border-line-subtle">
                  {t("health.card5.table.provider")}
                </th>
                <th className="px-5 py-3 font-bold tracking-wider uppercase border-b border-line-subtle">
                  {t("health.card5.table.amount")}
                </th>
                <th className="px-5 py-3 font-bold tracking-wider uppercase border-b border-line-subtle">
                  {t("health.card5.table.transaction")}
                </th>
                <th className="px-5 py-3 font-bold tracking-wider uppercase border-b border-line-subtle">
                  {t("health.card5.table.status")}
                </th>
                <th className="px-5 py-3 font-bold tracking-wider text-right uppercase border-b border-line-subtle">
                  {t("health.card5.table.cnssFile")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle/50">
              {records.map((record) => {
                const status =
                  STATUS_META[record.reimbursementStatus] ??
                  STATUS_META.PENDING;
                const isFinal = record.reimbursementStatus === "REIMBURSED";

                return (
                  <tr
                    key={record.id}
                    className="transition-colors hover:bg-surface-alt/30"
                  >
                    <td className="px-5 py-3 text-muted">
                      {new Date(record.date).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3 font-bold text-body">
                      {record.provider}
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {formatDH(record.amount)}
                    </td>
                    <td className="px-5 py-3 text-subtle">
                      {record.transaction ? (
                        <span className="text-[10px] text-emerald-400">
                          {t("health.card5.table.transaction.linked")}
                        </span>
                      ) : (
                        <span className="text-[10px] text-faint">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase ${status.color}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {isFinal ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                          <FileCheck2 className="w-3.5 h-3.5" />
                          {t("health.card5.table.status.filecnss.close")}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCnssUpdate(record)}
                          disabled={updatingId === record.id}
                          className="text-[10px] font-bold bg-surface-alt hover:bg-rose-600/20 text-body-soft hover:text-rose-400 px-3 py-1.5 rounded-lg border border-line transition-colors disabled:opacity-50"
                        >
                          {updatingId === record.id ? "..." : status.nextLabel}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {records.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-16 italic text-center text-subtle"
                  >
                    Aucun soin enregistré pour le moment. Ajoute le premier
                    ci-dessous.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Form */}
      <div className="p-6 border bg-surface rounded-xl border-line">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 border rounded-lg bg-rose-500/10 border-rose-500/20">
            <PlusCircle className="w-5 h-5 text-rose-400" />
          </div>
          <h3 className="text-lg font-bold tracking-tight text-ink">
            {t("health.card6.title")}
          </h3>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-4 md:grid-cols-5"
        >
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-[10px] uppercase font-bold text-subtle tracking-widest ml-1">
              {t("health.card6.form.provider")}
            </label>
            <input
              type="text"
              placeholder="Ex: Dr. Bennani, Pharmacie Centrale"
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
              className="bg-page border border-line text-body rounded-lg p-2.5 focus:border-rose-500 outline-none transition-colors text-sm"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-subtle tracking-widest ml-1">
              {t("health.card6.form.amount")} 
            </label>
            <input
              type="number"
              step="any"
              placeholder="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="bg-page border border-line text-body rounded-lg p-2.5 focus:border-rose-500 outline-none transition-colors text-sm"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-subtle tracking-widest ml-1">
              {t("health.card6.form.date")}
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="bg-page border border-line text-body rounded-lg p-2.5 focus:border-rose-500 outline-none transition-colors text-sm"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5 justify-end">
            <label className="flex items-center gap-2 text-[11px] text-muted py-2.5">
              <input
                type="checkbox"
                checked={form.linkTransaction}
                onChange={(e) =>
                  setForm({ ...form, linkTransaction: e.target.checked })
                }
                className="w-4 h-4 accent-rose-500"
              />
              {t("health.card6.form.transaction")}
            </label>
          </div>

          <div className="flex gap-3 md:col-span-5">
            <button
              type="submit"
              disabled={loading}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 px-6 rounded-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50 text-sm"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 rounded-full border-white/30 border-t-white animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {t("health.card6.form.submit")}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
