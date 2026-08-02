"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  Wallet,
  TrendingDown,
  Repeat,
  CreditCard,
  Receipt,
  ArrowRightLeft,
  PiggyBank,
  Download,
} from "lucide-react";
import FeatureGate from "../components/FeatureGate";
import CalendarOutlook from "../components/CalendarOutlook";
import CalendarSimulator from "../components/CalendarSimulator";
import BudgetDisciplineCard from "../components/BudgetDisciplineCard";
import MultiCycleOutlook from "../components/MultiCycleOutlook";
import { useLanguage } from "../components/LanguageProvider";

type SourceType = "subscription" | "debt" | "recurringTransfer" | "bill" | "savingsGoal";
type Status = "paid" | "upcoming" | "late";

interface CalendarEvent {
  id: string;
  sourceType: SourceType;
  sourceId: string;
  name: string;
  amountMad: number;
  dueDate: string;
  status: Status;
  affectsBalance: boolean;
}

interface ProjectionPoint {
  date: string;
  balanceMad: number;
  events: CalendarEvent[];
  safeDailySpendMad: number;
}

interface CategoryShare {
  categoryId: string;
  categoryName: string;
  shareMad: number;
}

interface DisciplineScore {
  totalDays: number;
  daysOnBudget: number;
  scorePct: number;
  worstWeekday: { key: string; overspendRatePct: number } | null;
  recentDays: { date: string; safeDailySpendMad: number; spentMad: number; onBudget: boolean }[];
}

interface CalendarData {
  events: CalendarEvent[];
  projection: {
    startBalanceMad: number;
    nextPayday: string;
    daysRemaining: number;
    committedOutflowMad: number;
    safeDailySpendMad: number;
    minProjectedBalanceMad: number;
    todaySpentMad: number;
    categoryBreakdown: CategoryShare[];
    disciplineScore: DisciplineScore;
    multiCycleOutlook: { cycleStart: string; cycleEnd: string; committedOutflowMad: number }[];
    points: ProjectionPoint[];
  };
}

interface BillItem {
  id: string;
  name: string;
  amount: number;
  dayOfMonth: number;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  isActive: boolean;
  manuallyPaidYearMonth: string | null;
}

interface OptionItem {
  id: string;
  name: string;
}

const formatMAD = (val: number) =>
  new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(val);

// Version compacte (sans symbole devise) pour les petites cases de la grille
// du calendrier — ex: 1250 -> "1,3k", 85 -> "85".
const formatCompactMAD = (val: number) =>
  new Intl.NumberFormat("fr-MA", { notation: "compact", maximumFractionDigits: 1 }).format(val);

const SOURCE_META: Record<SourceType, { icon: typeof Repeat; labelKey: string }> = {
  subscription: { icon: Repeat, labelKey: "calendar.source.subscription" },
  debt: { icon: CreditCard, labelKey: "calendar.source.debt" },
  recurringTransfer: { icon: ArrowRightLeft, labelKey: "calendar.source.transfer" },
  bill: { icon: Receipt, labelKey: "calendar.source.bill" },
  savingsGoal: { icon: PiggyBank, labelKey: "calendar.source.savingsGoal" },
};

const STATUS_STYLES: Record<Status, string> = {
  paid: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  upcoming: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  late: "text-red-400 bg-red-500/10 border-red-500/20",
};

const STATUS_DOT: Record<Status, string> = {
  paid: "bg-emerald-500",
  upcoming: "bg-blue-500",
  late: "bg-red-500",
};

function buildMonthGrid(year: number, month1to12: number): (number | null)[] {
  const first = new Date(year, month1to12 - 1, 1);
  // Lundi = 0 ... Dimanche = 6 (convention fr-FR)
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month1to12, 0).getDate();
  const cells: (number | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function CalendrierPage() {
  return (
    <FeatureGate featureKey="calendar" featureName="Calendrier">
      <CalendrierPageContent />
    </FeatureGate>
  );
}

function CalendrierPageContent() {
  const { t } = useLanguage();
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState<CalendarData | null>(null);
  const [bills, setBills] = useState<BillItem[]>([]);
  const [categories, setCategories] = useState<OptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", amount: "", dayOfMonth: "1", categoryId: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/calendar?year=${year}&month=${month}`).then((r) => r.json()),
      fetch("/api/bills").then((r) => r.json()),
    ])
      .then(([calRes, billsRes]) => {
        if (calRes.success) setData(calRes.data);
        if (billsRes.success) {
          setBills(billsRes.data);
          setCategories(billsRes.categories);
        }
      })
      .catch((err) => console.error("Calendrier fetch error:", err))
      .finally(() => setLoading(false));
  }, [year, month]);

  useEffect(() => {
    Promise.resolve().then(() => {
      load();
    });
  }, [load]);

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
    setSelectedDay(null);
  };

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    (data?.events ?? []).forEach((e) => {
      const day = new Date(e.dueDate).getDate();
      map.set(day, [...(map.get(day) ?? []), e]);
    });
    return map;
  }, [data]);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  // Budget dépense sécuritaire du jour, uniquement pour les jours couverts
  // par la projection (aujourd'hui -> prochaine paie) ET affichés dans le
  // mois courant — les points hors de cette fenêtre (mois passés, ou après
  // la paie) n'ont pas de scénario calculé.
  const dailyBudgetByDay = useMemo(() => {
    const map = new Map<number, number>();
    (data?.projection.points ?? []).forEach((p) => {
      const d = new Date(p.date);
      if (d.getFullYear() === year && d.getMonth() + 1 === month) {
        map.set(d.getDate(), p.safeDailySpendMad);
      }
    });
    return map;
  }, [data, year, month]);

  // Solde projeté en FIN de journée, même filtre que dailyBudgetByDay — sert
  // au panneau de détail affiché quand on clique sur une case du calendrier.
  const dailyBalanceByDay = useMemo(() => {
    const map = new Map<number, number>();
    (data?.projection.points ?? []).forEach((p) => {
      const d = new Date(p.date);
      if (d.getFullYear() === year && d.getMonth() + 1 === month) {
        map.set(d.getDate(), p.balanceMad);
      }
    });
    return map;
  }, [data, year, month]);

  // Case du calendrier cliquée — un clic sur le même jour désélectionne.
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const toggleDay = (day: number) => setSelectedDay((prev) => (prev === day ? null : day));

  const upcoming = useMemo(
    () => (data?.events ?? []).filter((e) => e.status !== "paid").sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [data],
  );

  const minProjectedBalance = useMemo(() => {
    if (!data?.projection.points.length) return null;
    return data.projection.minProjectedBalanceMad;
  }, [data]);

  const projectedEvents = useMemo(
    () => (data?.projection.points ?? []).flatMap((p) => p.events),
    [data],
  );

  const resetForm = () => {
    setForm({ name: "", amount: "", dayOfMonth: "1", categoryId: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (bill: BillItem) => {
    setForm({
      name: bill.name,
      amount: String(bill.amount),
      dayOfMonth: String(bill.dayOfMonth),
      categoryId: bill.categoryId ?? "",
    });
    setEditingId(bill.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        amount: Number(form.amount),
        dayOfMonth: Number(form.dayOfMonth),
        categoryId: form.categoryId || null,
      };
      const res = await fetch(editingId ? `/api/bills/${editingId}` : "/api/bills", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.success) {
        resetForm();
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/bills/${id}`, { method: "DELETE" });
    load();
  };

  const handleMarkPaid = async (event: CalendarEvent) => {
    if (event.sourceType !== "bill") return;
    await fetch(`/api/bills/${event.sourceId}/mark-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid: true }),
    });
    load();
  };

  return (
    <main className="min-h-screen bg-page p-4 sm:p-6 lg:p-8 text-body font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex items-center gap-3">
          <div className="p-3 border bg-blue-600/20 rounded-xl border-blue-500/20">
            <CalendarDays className="w-6 h-6 text-blue-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight text-ink">{t("calendar.title")}</h1>
            <p className="text-subtle text-sm mt-1 italic">{t("calendar.subtitle")}</p>
          </div>
          <a
            href="/api/calendar/export"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold border rounded-lg bg-surface border-line text-subtle hover:text-body hover:border-blue-500/40 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {t("calendar.exportIcs")}
          </a>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Colonne principale : calendrier + liste */}
            <div className="lg:col-span-2 space-y-6">
              <div className="p-6 border bg-surface rounded-2xl border-line">
                <div className="flex items-center justify-between mb-5">
                  <button
                    type="button"
                    onClick={() => changeMonth(-1)}
                    className="p-2 rounded-lg hover:bg-surface-alt text-subtle hover:text-body transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-ink">
                    {new Date(year, month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                  </h2>
                  <button
                    type="button"
                    onClick={() => changeMonth(1)}
                    className="p-2 rounded-lg hover:bg-surface-alt text-subtle hover:text-body transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1.5 text-center">
                  {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
                    <div key={d} className="text-[10px] font-bold uppercase text-faint py-1">
                      {d}
                    </div>
                  ))}
                  {grid.map((day, i) => {
                    const dayEvents = day ? (eventsByDay.get(day) ?? []) : [];
                    const dayBudget = day ? dailyBudgetByDay.get(day) : undefined;
                    const isToday =
                      day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
                    const isSelected = day !== null && day === selectedDay;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={!day}
                        onClick={() => day && toggleDay(day)}
                        className={`aspect-square rounded-lg border p-1 flex flex-col items-center justify-start gap-0.5 transition-colors ${
                          day ? "border-line-subtle cursor-pointer hover:border-blue-500/40 hover:bg-surface-alt" : "border-transparent cursor-default"
                        } ${isToday ? "bg-blue-500/10 border-blue-500/30" : ""} ${
                          isSelected ? "ring-2 ring-blue-500 border-blue-500/50" : ""
                        }`}
                      >
                        {day && (
                          <>
                            <span className={`text-[11px] ${isToday ? "font-bold text-blue-400" : "text-subtle"}`}>
                              {day}
                            </span>
                            <div className="flex flex-wrap gap-0.5 justify-center">
                              {dayEvents.slice(0, 4).map((e) => (
                                <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[e.status]}`} title={e.name} />
                              ))}
                            </div>
                            {dayBudget !== undefined && (
                              <span
                                className={`text-[9px] font-bold tabular-nums mt-auto ${
                                  dayBudget <= 0 ? "text-red-400" : "text-emerald-400/80"
                                }`}
                                title={`${t("calendar.outlook.dailyBudgetTitle")}: ${formatMAD(dayBudget)}`}
                              >
                                {formatCompactMAD(dayBudget)}
                              </span>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedDay !== null && (
                  <div className="mt-4 pt-4 border-t border-line-subtle">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-ink">
                        {new Date(year, month - 1, selectedDay).toLocaleDateString("fr-FR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setSelectedDay(null)}
                        className="p-1 rounded-lg text-faint hover:text-body hover:bg-surface-alt transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-4 mb-3">
                      {dailyBudgetByDay.has(selectedDay) && (
                        <div>
                          <p
                            className={`text-lg font-black tabular-nums ${
                              (dailyBudgetByDay.get(selectedDay) ?? 0) <= 0 ? "text-red-400" : "text-blue-400"
                            }`}
                          >
                            {formatMAD(dailyBudgetByDay.get(selectedDay) ?? 0)}
                          </p>
                          <p className="text-[9px] uppercase font-bold tracking-widest text-subtle">
                            {t("calendar.outlook.dailyBudgetTitle")}
                          </p>
                        </div>
                      )}
                      {dailyBalanceByDay.has(selectedDay) && (
                        <div>
                          <p
                            className={`text-lg font-black tabular-nums ${
                              (dailyBalanceByDay.get(selectedDay) ?? 0) < 0 ? "text-red-400" : "text-body"
                            }`}
                          >
                            {formatMAD(dailyBalanceByDay.get(selectedDay) ?? 0)}
                          </p>
                          <p className="text-[9px] uppercase font-bold tracking-widest text-subtle">
                            {t("calendar.projection.balanceCol")}
                          </p>
                        </div>
                      )}
                    </div>

                    {(eventsByDay.get(selectedDay) ?? []).length === 0 ? (
                      <p className="text-xs text-subtle italic">{t("calendar.noUpcoming")}</p>
                    ) : (
                      <div className="space-y-1.5">
                        {(eventsByDay.get(selectedDay) ?? []).map((e) => {
                          const meta = SOURCE_META[e.sourceType];
                          const Icon = meta.icon;
                          return (
                            <div
                              key={e.id}
                              className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${STATUS_STYLES[e.status]}`}
                            >
                              <Icon className="w-3.5 h-3.5 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-body truncate">{e.name}</p>
                                <p className="text-[10px] text-subtle">
                                  {t(meta.labelKey)}
                                  {!e.affectsBalance && ` · ${t("calendar.internalTransfer")}`}
                                </p>
                              </div>
                              <span className="text-xs font-black tabular-nums">{formatMAD(e.amountMad)}</span>
                              {e.sourceType === "bill" && e.status !== "paid" && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkPaid(e)}
                                  className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                                  title={t("calendar.markPaid")}
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-6 border bg-surface rounded-2xl border-line">
                <h3 className="text-sm font-bold uppercase tracking-widest text-subtle mb-4">
                  {t("calendar.upcoming")}
                </h3>
                {upcoming.length === 0 ? (
                  <p className="text-sm text-subtle italic">{t("calendar.noUpcoming")}</p>
                ) : (
                  <div className="space-y-2">
                    {upcoming.map((e) => {
                      const meta = SOURCE_META[e.sourceType];
                      const Icon = meta.icon;
                      return (
                        <div
                          key={e.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border ${STATUS_STYLES[e.status]}`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-body truncate">{e.name}</p>
                            <p className="text-[11px] text-subtle">
                              {new Date(e.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                              {!e.affectsBalance && ` · ${t("calendar.internalTransfer")}`}
                            </p>
                          </div>
                          <span className="text-sm font-black tabular-nums">{formatMAD(e.amountMad)}</span>
                          {e.sourceType === "bill" && e.status !== "paid" && (
                            <button
                              type="button"
                              onClick={() => handleMarkPaid(e)}
                              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                              title={t("calendar.markPaid")}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Colonne latérale : projection + factures manuelles */}
            <div className="space-y-6">
              {data && (
                <CalendarOutlook
                  startBalanceMad={data.projection.startBalanceMad}
                  committedOutflowMad={data.projection.committedOutflowMad}
                  safeDailySpendMad={data.projection.safeDailySpendMad}
                  daysRemaining={data.projection.daysRemaining}
                  nextPayday={data.projection.nextPayday}
                  minProjectedBalanceMad={data.projection.minProjectedBalanceMad}
                  upcomingEvents={projectedEvents.map((e) => ({
                    name: e.name,
                    amountMad: e.amountMad,
                    dueDate: e.dueDate,
                    sourceType: e.sourceType,
                  }))}
                  dailySeries={data.projection.points.map((p) => ({
                    date: p.date,
                    safeDailySpendMad: p.safeDailySpendMad,
                  }))}
                  todaySpentMad={data.projection.todaySpentMad}
                  categoryBreakdown={data.projection.categoryBreakdown}
                />
              )}

              <CalendarSimulator />

              {data && <BudgetDisciplineCard {...data.projection.disciplineScore} />}

              {data && <MultiCycleOutlook cycles={data.projection.multiCycleOutlook} />}

              <div className="p-6 border bg-surface-alt/50 rounded-2xl border-line">
                <div className="flex items-center gap-2 mb-4">
                  <Wallet className="w-4 h-4 text-blue-400" />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-subtle">
                    {t("calendar.projection.title")}
                  </h3>
                </div>
                <p className="text-2xl font-black text-ink tabular-nums">{formatMAD(data?.projection.startBalanceMad ?? 0)}</p>
                <p className="text-[11px] text-subtle mb-4">{t("calendar.projection.currentBalance")}</p>

                {minProjectedBalance !== null && (
                  <div
                    className={`flex items-center gap-2 p-3 rounded-xl border mb-4 ${
                      minProjectedBalance < 0
                        ? "bg-red-500/10 border-red-500/20 text-red-400"
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    <TrendingDown className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="text-sm font-black tabular-nums">{formatMAD(minProjectedBalance)}</p>
                      <p className="text-[10px] uppercase font-bold tracking-widest">{t("calendar.projection.lowPoint")}</p>
                    </div>
                  </div>
                )}

                {data?.projection.nextPayday && (
                  <p className="text-[11px] text-faint italic">
                    {t("calendar.projection.until")}{" "}
                    {new Date(data.projection.nextPayday).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                )}

                {data && data.projection.points.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-line-subtle space-y-1.5 max-h-56 overflow-y-auto">
                    <div className="flex items-center justify-between text-[9px] uppercase font-bold tracking-widest text-faint px-0.5 mb-1">
                      <span>{t("calendar.projection.dateCol")}</span>
                      <div className="flex items-center gap-3">
                        <span>{t("calendar.outlook.dailyBudgetTitle")}</span>
                        <span className="w-16 text-right">{t("calendar.projection.balanceCol")}</span>
                      </div>
                    </div>
                    {data.projection.points.map((p) => (
                      <div key={p.date} className="flex items-center justify-between text-[11px]">
                        <span className="text-subtle">
                          {new Date(p.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className={`font-bold tabular-nums ${p.safeDailySpendMad <= 0 ? "text-red-400" : "text-emerald-400"}`}>
                            {formatMAD(p.safeDailySpendMad)}
                          </span>
                          <span
                            className={`font-bold tabular-nums w-16 text-right ${p.balanceMad < 0 ? "text-red-400" : "text-body-soft"}`}
                          >
                            {formatMAD(p.balanceMad)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 border bg-surface rounded-2xl border-line">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-subtle">
                    {t("calendar.bills.title")}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setShowForm(true);
                    }}
                    className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {showForm && (
                  <form onSubmit={handleSubmit} className="space-y-2 mb-4 p-3 rounded-xl bg-surface-alt/50 border border-line-subtle">
                    <input
                      className="w-full bg-surface border border-line rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t("calendar.bills.namePlaceholder")}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="w-full bg-surface border border-line rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t("calendar.bills.amountPlaceholder")}
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                        required
                      />
                      <input
                        type="number"
                        min="1"
                        max="28"
                        className="w-full bg-surface border border-line rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t("calendar.bills.dayPlaceholder")}
                        value={form.dayOfMonth}
                        onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}
                        required
                      />
                    </div>
                    <select
                      className="w-full bg-surface border border-line rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.categoryId}
                      onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    >
                      <option value="">{t("calendar.bills.noCategory")}</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-1.5 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {t("common.save")}
                      </button>
                      <button
                        type="button"
                        onClick={resetForm}
                        className="px-3 py-1.5 rounded-lg border border-line text-subtle hover:text-body text-xs"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-1.5">
                  {bills.filter((b) => b.isActive).map((b) => (
                    <div key={b.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-alt/50 group">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-body truncate">{b.name}</p>
                        <p className="text-[10px] text-faint">
                          {t("calendar.bills.dayLabel")} {b.dayOfMonth} · {formatMAD(b.amount)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => startEdit(b)}
                        className="p-1 text-faint hover:text-body opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(b.id)}
                        className="p-1 text-faint hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {bills.filter((b) => b.isActive).length === 0 && !showForm && (
                    <p className="text-xs text-subtle italic">{t("calendar.bills.empty")}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
