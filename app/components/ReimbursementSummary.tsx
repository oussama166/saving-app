'use client';

import { Clock, Send, CheckCircle2, FileText } from 'lucide-react';
import type { MedicalRecordRow } from './MedicalRecordsTable';

interface Props {
  records: MedicalRecordRow[];
}

const formatCUR = (val: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(val);

export default function ReimbursementSummary({ records }: Props) {
  const byStatus = (status: string) => records.filter((r) => r.reimbursementStatus === status);

  const pending = byStatus('PENDING');
  const submitted = byStatus('SUBMITTED');
  const reimbursed = byStatus('REIMBURSED');

  const sum = (rows: MedicalRecordRow[]) => rows.reduce((acc, r) => acc + r.amount, 0);

  const rows = [
    {
      label: 'En Attente',
      count: pending.length,
      amount: sum(pending),
      icon: Clock,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10 border-orange-500/20',
    },
    {
      label: 'Soumis à la CNSS',
      count: submitted.length,
      amount: sum(submitted),
      icon: Send,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
    },
    {
      label: 'Remboursés',
      count: reimbursed.length,
      amount: sum(reimbursed),
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
  ];

  return (
    <div className="bg-[#1b253b] rounded-2xl border border-slate-700 p-6 shadow-2xl h-full space-y-4">
      <div className="flex items-center gap-3">
        <FileText className="w-5 h-5 text-rose-400" />
        <h3 className="text-sm font-bold uppercase tracking-widest text-white">Suivi Remboursements</h3>
      </div>

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className={`p-3 rounded-xl border ${r.bg} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <r.icon className={`w-4 h-4 ${r.color}`} />
              <span className="text-[11px] font-bold text-slate-300">
                {r.label} <span className="text-slate-500">({r.count})</span>
              </span>
            </div>
            <p className={`text-sm font-black ${r.color}`}>{formatCUR(r.amount)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
