import type { MaintenanceCategory, UpgradeCategory } from "@prisma/client";
import { formatDateOnly, monthsBetweenUTC } from "@/lib/dates";

// Fuel is a single category of its own ("Combustível"), whatever the fuel type.
export const FUEL_CATEGORY = "FUEL" as const;

export type FinanceEntry = {
  kind: "maintenance" | "upgrade" | "fuel";
  date: Date; // UTC midnight
  costCents: number;
  category: MaintenanceCategory | UpgradeCategory | typeof FUEL_CATEGORY;
  title: string; // maintenance title, upgrade name or "Abastecimento"
  vehicleId: string;
};

export type FinancePeriod = "6m" | "12m" | "year" | "all";

// Distance driven per vehicle: odometer at the first logged service or fill → current reading.
export type Odometer = { vehicleId: string; currentKm: number; firstKm: number };

export type FinanceInput = {
  entries: FinanceEntry[]; // whole history; the period is applied here
  odometers: Odometer[];
  today: Date;
  period?: FinancePeriod; // defaults to "all"
};

export type MonthTotal = { month: string; cents: number }; // month = "YYYY-MM"
export type CategoryTotal = Pick<FinanceEntry, "kind" | "category"> & { cents: number };

export type FinanceSummary = {
  maintenanceCents: number;
  upgradeCents: number;
  fuelCents: number;
  totalCents: number;
  monthlyAvgCents: number; // total / months in byMonth
  costPerKmCents: number | null; // whole history, whatever the period
  maxExpense: FinanceEntry | null;
  byMonth: MonthTotal[]; // every month of the span, zero-filled
  byCategory: CategoryTotal[]; // largest first, only categories with spend
  byVehicle: Record<string, number>; // vehicleId → cents in the period
};

const sum = (xs: FinanceEntry[]) => xs.reduce((a, e) => a + e.costCents, 0);
// Month overflow rolls the year (month -3 → October of the previous year).
const monthStartUTC = (year: number, month: number) => new Date(Date.UTC(year, month, 1));

export const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const keyToDate = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return monthStartUTC(y, m - 1);
};

// "2026-03" → "mar/26" (axis ticks, captions).
export const shortMonthLabel = (key: string) => formatDateOnly(keyToDate(key), "MMM/yy");
// "2026-03" → "março de 2026" (tooltips).
export const longMonthLabel = (key: string) => formatDateOnly(keyToDate(key), "MMMM 'de' yyyy");
// "Troca de embreagem · mar/26"
export const expenseLabel = (e: Pick<FinanceEntry, "title" | "date">) => `${e.title} · ${shortMonthLabel(monthKey(e.date))}`;

// Windows are whole calendar months ending in today's month ("6m" in November = Jun–Nov), so the
// first bucket is never partial and the average divides by exactly 6 or 12. null = whole history.
export function periodStart(period: FinancePeriod, today: Date): Date | null {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  if (period === "6m") return monthStartUTC(y, m - 5);
  if (period === "12m") return monthStartUTC(y, m - 11);
  if (period === "year") return monthStartUTC(y, 0);
  return null;
}

export function filterByPeriod(entries: FinanceEntry[], period: FinancePeriod, today: Date): FinanceEntry[] {
  const start = periodStart(period, today);
  return start ? entries.filter((e) => e.date.getTime() >= start.getTime()) : entries;
}

// Totals for every month from `from` through `to`; months without spending are zero, so the
// chart doesn't draw a straight line across them.
export function monthlySeries(entries: FinanceEntry[], from: Date, to: Date): MonthTotal[] {
  const totals = new Map<string, number>();
  for (const e of entries) {
    const k = monthKey(e.date);
    totals.set(k, (totals.get(k) ?? 0) + e.costCents);
  }
  const count = Math.max(0, monthsBetweenUTC(from, to) + 1);
  return Array.from({ length: count }, (_, i) => {
    const month = monthKey(monthStartUTC(from.getUTCFullYear(), from.getUTCMonth() + i));
    return { month, cents: totals.get(month) ?? 0 };
  });
}

// Keyed by kind + category: maintenance and upgrades both have BRAKES, SUSPENSION and OTHER.
export function categoryTotals(entries: FinanceEntry[]): CategoryTotal[] {
  const totals = new Map<string, CategoryTotal>();
  for (const e of entries) {
    const key = `${e.kind}:${e.category}`;
    const t = totals.get(key) ?? { kind: e.kind, category: e.category, cents: 0 };
    t.cents += e.costCents;
    totals.set(key, t);
  }
  return [...totals.values()].filter((t) => t.cents > 0).sort((a, b) => b.cents - a.cents);
}

// Largest single expense, the most recent on a tie; null when nothing cost anything.
export function maxExpense(entries: FinanceEntry[]): FinanceEntry | null {
  let max: FinanceEntry | null = null;
  for (const e of entries) {
    if (e.costCents <= 0) continue;
    if (!max || e.costCents > max.costCents || (e.costCents === max.costCents && e.date.getTime() > max.date.getTime())) max = e;
  }
  return max;
}

// Whole history only: the odometer at a period's start is unknown. Vehicles with no distance
// driven are left out, or their spend would inflate the rate.
export function costPerKmCents(entries: FinanceEntry[], odometers: Odometer[]): number | null {
  let cents = 0;
  let km = 0;
  for (const o of odometers) {
    const driven = o.currentKm - o.firstKm;
    if (driven <= 0) continue;
    km += driven;
    cents += sum(entries.filter((e) => e.vehicleId === o.vehicleId));
  }
  return km > 0 ? Math.round(cents / km) : null;
}

export function summarizeFinance({ entries: all, odometers, today, period = "all" }: FinanceInput): FinanceSummary {
  const entries = filterByPeriod(all, period, today);
  const maintenanceCents = sum(entries.filter((e) => e.kind === "maintenance"));
  const upgradeCents = sum(entries.filter((e) => e.kind === "upgrade"));
  const fuelCents = sum(entries.filter((e) => e.kind === "fuel"));
  const totalCents = maintenanceCents + upgradeCents + fuelCents;
  // Span: period start (or the first expense, for the whole history) through today's month,
  // or the latest expense's if it's dated later.
  const times = entries.map((e) => e.date.getTime());
  const from = periodStart(period, today) ?? (times.length ? new Date(Math.min(...times)) : null);
  const to = new Date(Math.max(today.getTime(), ...times));
  const byMonth = from ? monthlySeries(entries, from, to) : [];
  const byVehicle: Record<string, number> = {};
  for (const e of entries) byVehicle[e.vehicleId] = (byVehicle[e.vehicleId] ?? 0) + e.costCents;
  return {
    maintenanceCents, upgradeCents, fuelCents, totalCents,
    monthlyAvgCents: byMonth.length ? Math.round(totalCents / byMonth.length) : 0,
    costPerKmCents: costPerKmCents(all, odometers),
    maxExpense: maxExpense(entries),
    byMonth,
    byCategory: categoryTotals(entries),
    byVehicle,
  };
}

// Flattens a vehicle's records into finance entries (Prisma rows fit as they are).
export function toFinanceEntries(v: {
  id: string;
  maintenances: { date: Date; costCents: number; category: MaintenanceCategory; title: string }[];
  upgrades: { date: Date; costCents: number; category: UpgradeCategory; name: string }[];
  fuelRecords: { date: Date; costCents: number }[];
}): FinanceEntry[] {
  return [
    ...v.maintenances.map((m) => ({ kind: "maintenance" as const, date: m.date, costCents: m.costCents, category: m.category, title: m.title, vehicleId: v.id })),
    ...v.upgrades.map((u) => ({ kind: "upgrade" as const, date: u.date, costCents: u.costCents, category: u.category, title: u.name, vehicleId: v.id })),
    ...v.fuelRecords.map((f) => ({ kind: "fuel" as const, date: f.date, costCents: f.costCents, category: FUEL_CATEGORY, title: "Abastecimento", vehicleId: v.id })),
  ];
}

// Odometer at the first logged service or fill (upgrades carry no km); with neither, no distance is known.
// Fills count because their spend is in the total: fuel logged since 50.000 km is spread over the km since then.
export function firstLoggedKm(v: { currentKm: number; maintenances: { km: number }[]; fuelRecords: { km: number }[] }): number {
  const kms = [...v.maintenances, ...v.fuelRecords].map((r) => r.km);
  return kms.length ? Math.min(...kms) : v.currentKm;
}
