import { monthsBetweenUTC } from "@/lib/dates";

export type FinanceInput = {
  currentKm: number;
  firstKm: number;
  today: Date;
  maintenances: { date: Date; costCents: number }[];
  upgrades: { date: Date; costCents: number }[];
};
export type FinanceSummary = {
  maintenanceCents: number;
  upgradeCents: number;
  totalCents: number;
  monthlyAvgCents: number;
  costPerKmCents: number | null;
  maxExpenseCents: number;
  byMonth: { month: string; cents: number }[];
};

const sum = (xs: { costCents: number }[]) => xs.reduce((a, x) => a + x.costCents, 0);
const ym = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export function summarizeVehicle(input: FinanceInput): FinanceSummary {
  const maintenanceCents = sum(input.maintenances);
  const upgradeCents = sum(input.upgrades);
  const totalCents = maintenanceCents + upgradeCents;
  const km = input.currentKm - input.firstKm;
  const all = [...input.maintenances, ...input.upgrades];
  const byMonthMap = new Map<string, number>();
  for (const e of all) byMonthMap.set(ym(e.date), (byMonthMap.get(ym(e.date)) ?? 0) + e.costCents);
  const byMonth = [...byMonthMap.entries()].map(([month, cents]) => ({ month, cents })).sort((a, b) => a.month.localeCompare(b.month));
  // Average over every month from the first expense to today (or the latest expense, if later),
  // so months without spending pull the average down instead of being skipped.
  const times = all.map((e) => e.date.getTime());
  const spanMonths = all.length
    ? monthsBetweenUTC(new Date(Math.min(...times)), new Date(Math.max(input.today.getTime(), ...times))) + 1
    : 1;
  return {
    maintenanceCents, upgradeCents, totalCents,
    monthlyAvgCents: Math.round(totalCents / spanMonths),
    costPerKmCents: km > 0 ? Math.round(totalCents / km) : null,
    maxExpenseCents: all.reduce((m, e) => Math.max(m, e.costCents), 0),
    byMonth,
  };
}
