export type FinanceInput = {
  currentKm: number;
  firstKm: number;
  maintenances: { date: Date; costCents: number }[];
  upgrades: { date: Date; costCents: number }[];
};
export type FinanceSummary = {
  maintenanceCents: number;
  upgradeCents: number;
  totalCents: number;
  costPerKmCents: number | null;
  maxExpenseCents: number;
  byMonth: { month: string; cents: number }[];
};

const sum = (xs: { costCents: number }[]) => xs.reduce((a, x) => a + x.costCents, 0);
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export function summarizeVehicle(input: FinanceInput): FinanceSummary {
  const maintenanceCents = sum(input.maintenances);
  const upgradeCents = sum(input.upgrades);
  const totalCents = maintenanceCents + upgradeCents;
  const km = input.currentKm - input.firstKm;
  const all = [...input.maintenances, ...input.upgrades];
  const byMonthMap = new Map<string, number>();
  for (const e of all) byMonthMap.set(ym(e.date), (byMonthMap.get(ym(e.date)) ?? 0) + e.costCents);
  const byMonth = [...byMonthMap.entries()].map(([month, cents]) => ({ month, cents })).sort((a, b) => a.month.localeCompare(b.month));
  return {
    maintenanceCents, upgradeCents, totalCents,
    costPerKmCents: km > 0 ? Math.round(totalCents / km) : null,
    maxExpenseCents: all.reduce((m, e) => Math.max(m, e.costCents), 0),
    byMonth,
  };
}
