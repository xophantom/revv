import { describe, it, expect } from "vitest";
import { summarizeVehicle, type FinanceInput } from "@/domain/finance";

const input: FinanceInput = {
  currentKm: 87430,
  firstKm: 80000,
  maintenances: [
    { date: new Date("2026-04-12"), costCents: 38000 },
    { date: new Date("2026-01-28"), costCents: 54000 },
  ],
  upgrades: [{ date: new Date("2026-03-01"), costCents: 250000 }],
};

describe("summarizeVehicle", () => {
  it("totals maintenance, upgrade, and grand total in cents", () => {
    const s = summarizeVehicle(input);
    expect(s.maintenanceCents).toBe(92000);
    expect(s.upgradeCents).toBe(250000);
    expect(s.totalCents).toBe(342000);
  });
  it("computes cost per km over distance driven", () => {
    const s = summarizeVehicle(input);
    expect(s.costPerKmCents).toBe(Math.round(342000 / 7430));
  });
  it("buckets spend by month (YYYY-MM)", () => {
    const s = summarizeVehicle(input);
    const apr = s.byMonth.find((m) => m.month === "2026-04")!;
    expect(apr.cents).toBe(38000);
  });
  it("finds the largest single expense", () => {
    expect(summarizeVehicle(input).maxExpenseCents).toBe(250000);
  });
});
