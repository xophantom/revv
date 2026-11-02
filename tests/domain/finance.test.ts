import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  summarizeFinance, periodStart, filterByPeriod, monthlySeries, categoryTotals, maxExpense, costPerKmCents,
  shortMonthLabel, longMonthLabel, expenseLabel, toFinanceEntries, firstLoggedKm,
  type FinanceEntry, type FinanceInput,
} from "@/domain/finance";

// Run in BRT (UTC-3): a UTC-midnight date reads as the previous day locally, so any code
// reading local parts instead of UTC parts would land entries in the wrong month.
beforeAll(() => { vi.stubEnv("TZ", "America/Sao_Paulo"); });
afterAll(() => { vi.unstubAllEnvs(); });

const d = (iso: string) => new Date(iso); // "YYYY-MM-DD" → UTC midnight, like stored dates
const entry = (date: string, costCents: number, over: Partial<FinanceEntry> = {}): FinanceEntry => ({
  kind: "maintenance", date: d(date), costCents, category: "OIL", title: "Serviço", vehicleId: "v1", ...over,
});

const entries: FinanceEntry[] = [
  entry("2026-04-12", 38000, { category: "BRAKES", title: "Pastilhas" }),
  entry("2026-01-28", 54000, { category: "OIL", title: "Troca de óleo" }),
  entry("2026-03-01", 250000, { kind: "upgrade", category: "EXHAUST", title: "Escape inox" }),
];
const input: FinanceInput = {
  entries,
  odometers: [{ vehicleId: "v1", currentKm: 87430, firstKm: 80000 }],
  today: d("2026-05-31"),
};

describe("summarizeFinance", () => {
  it("runs with the process in a UTC-3 timezone", () => {
    expect(d("2026-06-01").getDate()).toBe(31);
  });

  it("totals maintenance, upgrade and grand total in cents", () => {
    const s = summarizeFinance(input);
    expect(s.maintenanceCents).toBe(92000);
    expect(s.upgradeCents).toBe(250000);
    expect(s.totalCents).toBe(342000);
  });

  it("zero-fills months without spending, from the first expense through today's month", () => {
    expect(summarizeFinance(input).byMonth).toEqual([
      { month: "2026-01", cents: 54000 },
      { month: "2026-02", cents: 0 },
      { month: "2026-03", cents: 250000 },
      { month: "2026-04", cents: 38000 },
      { month: "2026-05", cents: 0 },
    ]);
  });

  it("averages over every month of the span, including months without spend", () => {
    expect(summarizeFinance(input).monthlyAvgCents).toBe(Math.round(342000 / 5));
    const sparse = summarizeFinance({
      ...input,
      today: d("2026-11-15"),
      entries: [entry("2026-01-10", 60000), entry("2026-11-10", 60000)],
    });
    expect(sparse.byMonth).toHaveLength(11);
    expect(sparse.monthlyAvgCents).toBe(Math.round(120000 / 11));
  });

  it("extends the span to an expense dated after today", () => {
    const s = summarizeFinance({ ...input, entries: [...entries, entry("2026-07-02", 1000)] });
    expect(s.byMonth.at(-1)).toEqual({ month: "2026-07", cents: 1000 });
  });

  it("returns empty series, zero average and no max with no expenses", () => {
    const s = summarizeFinance({ ...input, entries: [] });
    expect(s.byMonth).toEqual([]);
    expect(s.monthlyAvgCents).toBe(0);
    expect(s.maxExpense).toBeNull();
    expect(s.byCategory).toEqual([]);
  });

  it("starts a selected period's series at the period start, zero-filled", () => {
    const s = summarizeFinance({ ...input, period: "6m", today: d("2026-11-02"), entries: [entry("2026-08-15", 12000)] });
    expect(s.byMonth.map((m) => m.month)).toEqual(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(s.byMonth.map((m) => m.cents)).toEqual([0, 0, 12000, 0, 0, 0]);
    expect(s.monthlyAvgCents).toBe(2000);
  });

  it("keeps a period's months when it has no expenses", () => {
    const s = summarizeFinance({ ...input, period: "12m", today: d("2026-11-02"), entries: [entry("2024-02-01", 5000)] });
    expect(s.byMonth).toHaveLength(12);
    expect(s.totalCents).toBe(0);
    expect(s.monthlyAvgCents).toBe(0);
  });

  it("averages the calendar year over the months elapsed so far", () => {
    const s = summarizeFinance({
      ...input,
      period: "year",
      today: d("2026-11-02"),
      entries: [entry("2025-12-31", 99900), entry("2026-01-01", 22000), entry("2026-10-31", 11000)],
    });
    expect(s.totalCents).toBe(33000);
    expect(s.byMonth[0].month).toBe("2026-01");
    expect(s.byMonth).toHaveLength(11);
    expect(s.monthlyAvgCents).toBe(3000);
  });

  it("computes cost per km over the whole history, whatever the period", () => {
    const lifetime = Math.round(342000 / 7430);
    expect(summarizeFinance(input).costPerKmCents).toBe(lifetime);
    // "6m" from September is Apr–Sep: only the April expense counts, but cost per km still uses all three.
    const recent = summarizeFinance({ ...input, period: "6m", today: d("2026-09-10") });
    expect(recent.totalCents).toBe(38000);
    expect(recent.costPerKmCents).toBe(lifetime);
  });

  it("picks the largest expense within the period", () => {
    expect(summarizeFinance(input).maxExpense?.title).toBe("Escape inox");
    expect(summarizeFinance({ ...input, period: "6m", today: d("2026-09-10") }).maxExpense?.title).toBe("Pastilhas");
  });

  it("totals spend per vehicle within the period", () => {
    const s = summarizeFinance({
      ...input,
      period: "6m",
      today: d("2026-05-31"),
      entries: [...entries, entry("2026-05-02", 7000, { vehicleId: "v2" }), entry("2025-11-30", 9000, { vehicleId: "v2" })],
    });
    expect(s.byVehicle).toEqual({ v1: 342000, v2: 7000 });
  });
});

describe("fuel", () => {
  const fuel = (date: string, costCents: number, over: Partial<FinanceEntry> = {}) =>
    entry(date, costCents, { kind: "fuel", category: "FUEL", title: "Abastecimento", ...over });

  it("counts fuel as spending, in its own share of the total", () => {
    const s = summarizeFinance({ ...input, entries: [...entries, fuel("2026-02-10", 25000), fuel("2026-04-20", 27000)] });
    expect(s.fuelCents).toBe(52000);
    expect(s.maintenanceCents).toBe(92000);
    expect(s.upgradeCents).toBe(250000);
    expect(s.totalCents).toBe(394000);
    expect(s.maintenanceCents + s.upgradeCents + s.fuelCents).toBe(s.totalCents);
  });

  it("adds fuel to the monthly bars, the category breakdown and cost per km", () => {
    const s = summarizeFinance({ ...input, entries: [...entries, fuel("2026-02-10", 25000), fuel("2026-04-20", 27000)] });
    expect(s.byMonth.find((m) => m.month === "2026-02")?.cents).toBe(25000);
    expect(s.byMonth.find((m) => m.month === "2026-04")?.cents).toBe(38000 + 27000);
    expect(s.byCategory).toContainEqual({ kind: "fuel", category: "FUEL", cents: 52000 });
    expect(s.costPerKmCents).toBe(Math.round(394000 / 7430));
  });

  it("keeps fuel out of the maintenance and upgrade totals", () => {
    const s = summarizeFinance({ ...input, entries: [fuel("2026-03-01", 30000)] });
    expect(s).toMatchObject({ maintenanceCents: 0, upgradeCents: 0, fuelCents: 30000, totalCents: 30000 });
    expect(s.maxExpense?.title).toBe("Abastecimento");
  });

  it("filters fuel by period like any other expense", () => {
    const s = summarizeFinance({ ...input, period: "6m", today: d("2026-09-10"), entries: [fuel("2026-03-31", 1000), fuel("2026-04-01", 2000)] });
    expect(s.fuelCents).toBe(2000);
  });
});

describe("periods", () => {
  const today = d("2026-11-02");

  it("uses whole calendar months ending in today's month", () => {
    expect(periodStart("6m", today)?.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(periodStart("12m", today)?.toISOString()).toBe("2025-12-01T00:00:00.000Z");
    expect(periodStart("year", today)?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(periodStart("all", today)).toBeNull();
  });

  it("rolls back across the year boundary", () => {
    expect(periodStart("6m", d("2026-03-15"))?.toISOString()).toBe("2025-10-01T00:00:00.000Z");
    expect(periodStart("12m", d("2026-01-01"))?.toISOString()).toBe("2025-02-01T00:00:00.000Z");
  });

  it("includes the first day of the period and excludes the last day before it", () => {
    const xs = [entry("2025-11-30", 1), entry("2025-12-01", 2), entry("2025-12-31", 3), entry("2026-01-01", 4), entry("2026-05-31", 5), entry("2026-06-01", 6)];
    const kept = (p: Parameters<typeof filterByPeriod>[1]) => filterByPeriod(xs, p, today).map((e) => e.costCents);
    expect(kept("6m")).toEqual([6]);
    expect(kept("year")).toEqual([4, 5, 6]);
    expect(kept("12m")).toEqual([2, 3, 4, 5, 6]);
    expect(kept("all")).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("monthlySeries", () => {
  it("buckets by UTC month and fills gaps across years", () => {
    const s = monthlySeries([entry("2025-12-31", 100), entry("2026-02-01", 200), entry("2026-02-28", 50)], d("2025-11-01"), d("2026-02-10"));
    expect(s).toEqual([
      { month: "2025-11", cents: 0 },
      { month: "2025-12", cents: 100 },
      { month: "2026-01", cents: 0 },
      { month: "2026-02", cents: 250 },
    ]);
  });
});

describe("categoryTotals", () => {
  it("totals per kind + category, largest first, skipping categories without spend", () => {
    const totals = categoryTotals([
      entry("2026-01-01", 10000, { category: "BRAKES" }),
      entry("2026-02-01", 5000, { category: "BRAKES" }),
      entry("2026-03-01", 40000, { kind: "upgrade", category: "BRAKES" }),
      entry("2026-04-01", 8000, { category: "OIL" }),
      entry("2026-05-01", 0, { category: "FILTERS" }),
    ]);
    expect(totals).toEqual([
      { kind: "upgrade", category: "BRAKES", cents: 40000 },
      { kind: "maintenance", category: "BRAKES", cents: 15000 },
      { kind: "maintenance", category: "OIL", cents: 8000 },
    ]);
  });
});

describe("maxExpense", () => {
  it("prefers the most recent on a tie and ignores zero-cost entries", () => {
    expect(maxExpense([entry("2026-01-01", 500, { title: "A" }), entry("2026-03-01", 500, { title: "B" })])?.title).toBe("B");
    expect(maxExpense([entry("2026-01-01", 0)])).toBeNull();
  });

  it("labels the expense with its title and short month", () => {
    expect(expenseLabel({ title: "Troca de embreagem", date: d("2026-03-01") })).toBe("Troca de embreagem · mar/26");
    expect(expenseLabel(maxExpense(entries)!)).toBe("Escape inox · mar/26");
  });
});

describe("costPerKmCents", () => {
  it("leaves out vehicles with no distance driven", () => {
    const xs = [entry("2026-01-01", 100000, { vehicleId: "a" }), entry("2026-01-01", 500000, { vehicleId: "b" })];
    const odometers = [
      { vehicleId: "a", currentKm: 12000, firstKm: 10000 },
      { vehicleId: "b", currentKm: 5000, firstKm: 5000 },
    ];
    expect(costPerKmCents(xs, odometers)).toBe(50);
    expect(costPerKmCents(xs, [odometers[1]])).toBeNull();
  });
});

describe("labels", () => {
  it("formats month keys in pt-BR", () => {
    expect(shortMonthLabel("2026-03")).toBe("mar/26");
    expect(shortMonthLabel("2025-12")).toBe("dez/25");
    expect(longMonthLabel("2026-03")).toBe("março de 2026");
  });
});

describe("record mapping", () => {
  it("flattens maintenances, upgrades and fills into entries", () => {
    const xs = toFinanceEntries({
      id: "v9",
      maintenances: [{ date: d("2026-01-05"), costCents: 1000, category: "OIL", title: "Óleo" }],
      upgrades: [{ date: d("2026-02-05"), costCents: 2000, category: "ECU", name: "Remap" }],
      fuelRecords: [{ date: d("2026-03-05"), costCents: 25000 }],
    });
    expect(xs).toEqual([
      { kind: "maintenance", date: d("2026-01-05"), costCents: 1000, category: "OIL", title: "Óleo", vehicleId: "v9" },
      { kind: "upgrade", date: d("2026-02-05"), costCents: 2000, category: "ECU", title: "Remap", vehicleId: "v9" },
      { kind: "fuel", date: d("2026-03-05"), costCents: 25000, category: "FUEL", title: "Abastecimento", vehicleId: "v9" },
    ]);
  });

  it("takes the first logged km, or the current km without services", () => {
    expect(firstLoggedKm({ currentKm: 90000, maintenances: [{ km: 85000 }, { km: 80000 }], fuelRecords: [] })).toBe(80000);
    expect(firstLoggedKm({ currentKm: 90000, maintenances: [], fuelRecords: [] })).toBe(90000);
  });

  it("counts fills in the first logged km", () => {
    expect(firstLoggedKm({ currentKm: 90000, maintenances: [{ km: 85000 }], fuelRecords: [{ km: 82000 }, { km: 88000 }] })).toBe(82000);
    expect(firstLoggedKm({ currentKm: 90000, maintenances: [], fuelRecords: [{ km: 86000 }] })).toBe(86000);
  });
});
