import { describe, it, expect } from "vitest";
import { computeAlerts, type AlertInput } from "@/domain/alerts";

const base: AlertInput = {
  currentKm: 87430,
  today: new Date("2026-05-31"),
  spec: { engineOil: { intervalKm: 10000 }, tires: { rotationKm: 10000 } },
  maintenances: [
    { category: "OIL", date: new Date("2026-04-12"), km: 84600, specRuleId: null },
    { category: "TIRES", date: new Date("2025-11-03"), km: 80000, specRuleId: null },
  ],
  customAlerts: [],
};

describe("computeAlerts", () => {
  it("computes remaining km for oil from last OIL service", () => {
    const a = computeAlerts(base).find((x) => x.id === "engineOil")!;
    expect(a.remainingKm).toBe(7170);
    expect(a.status).toBe("ok");
    expect(a.driver).toBe("km");
  });
  it("flags overdue when remaining km is negative", () => {
    const a = computeAlerts({ ...base, currentKm: 96000 }).find((x) => x.id === "engineOil")!;
    expect(a.remainingKm).toBeLessThan(0);
    expect(a.status).toBe("overdue");
  });
  it("flags soon within threshold (<= 1500 km)", () => {
    const a = computeAlerts({ ...base, currentKm: 93500 }).find((x) => x.id === "engineOil")!;
    expect(a.status).toBe("soon");
  });
  it("includes custom alerts by due km", () => {
    const out = computeAlerts({ ...base, customAlerts: [{ id: "c1", label: "Trocar palheta", dueKm: 88000, dueDate: null, done: false }] });
    const c = out.find((x) => x.id === "c1")!;
    expect(c.remainingKm).toBe(570);
    expect(c.label).toBe("Trocar palheta");
  });
  it("omits done custom alerts", () => {
    const out = computeAlerts({ ...base, customAlerts: [{ id: "c1", label: "x", dueKm: 88000, dueDate: null, done: true }] });
    expect(out.find((x) => x.id === "c1")).toBeUndefined();
  });
  it("sorts most urgent first", () => {
    const out = computeAlerts({ ...base, currentKm: 96000 });
    expect(out[0].status).toBe("overdue");
  });

  // --- regressions from the adversarial review ---

  it("reports unknown (not ok) for a rule with no service history", () => {
    const a = computeAlerts({ ...base, maintenances: [] }).find((x) => x.id === "engineOil")!;
    expect(a.status).toBe("unknown");
    expect(a.remainingKm).toBeNull();
    expect(a.driver).toBeNull();
  });

  it("does NOT let one shared-category (FILTERS) record reset sibling filter alerts", () => {
    const out = computeAlerts({
      ...base,
      currentKm: 90000,
      spec: { airFilter: { intervalKm: 15000 }, cabinFilter: { intervalKm: 15000 } },
      // a single FILTERS record tagged to the air filter only
      maintenances: [{ category: "FILTERS", date: new Date("2026-01-01"), km: 88000, specRuleId: "airFilter" }],
    });
    const air = out.find((x) => x.id === "airFilter")!;
    const cabin = out.find((x) => x.id === "cabinFilter")!;
    expect(air.remainingKm).toBe(13000); // 15000 - (90000-88000)
    expect(air.status).toBe("ok");
    expect(cabin.status).toBe("unknown"); // untagged shared category → no baseline, not contaminated
  });

  it("matches a tagged record over a category sibling", () => {
    const out = computeAlerts({
      ...base,
      currentKm: 90000,
      spec: { brakeFluid: { intervalMonths: 24 }, coolant: { intervalMonths: 60 } },
      maintenances: [
        { category: "FLUIDS", date: new Date("2026-05-01"), km: 89000, specRuleId: "coolant" },
        { category: "FLUIDS", date: new Date("2024-01-01"), km: 70000, specRuleId: "brakeFluid" },
      ],
    });
    const brake = out.find((x) => x.id === "brakeFluid")!;
    // brake fluid anchored to its OWN early-2024 record (due 2026-01-01), NOT the recent coolant top-off.
    expect(brake.status).toBe("overdue");
    expect(brake.remainingDays).toBe(-150);
  });

  it("generates an alert for transmissionOil interval", () => {
    const a = computeAlerts({ ...base, spec: { transmissionOil: { intervalKm: 60000 } } }).find((x) => x.id === "transmissionOil");
    expect(a).toBeDefined();
    expect(a!.status).toBe("unknown"); // no FLUIDS service tagged
  });

  it("uses timingBelt.lastChangeKm as baseline when no service is logged", () => {
    const a = computeAlerts({
      ...base,
      currentKm: 100000,
      spec: { timingBelt: { intervalKm: 120000, lastChangeKm: 40000 } },
      maintenances: [],
    }).find((x) => x.id === "timingBelt")!;
    expect(a.remainingKm).toBe(60000); // 120000 - (100000-40000)
    expect(a.status).toBe("ok");
  });

  it("reports the time dimension as driver when km is fine but time is overdue", () => {
    const a = computeAlerts({
      ...base,
      currentKm: 85000, // only 400 km since service -> km fine
      today: new Date("2027-06-01"),
      spec: { engineOil: { intervalKm: 10000, intervalMonths: 12 } },
      maintenances: [{ category: "OIL", date: new Date("2026-04-12"), km: 84600, specRuleId: null }],
    }).find((x) => x.id === "engineOil")!;
    expect(a.status).toBe("overdue");
    expect(a.driver).toBe("time");
    expect(a.remainingKm).toBeGreaterThan(0); // km still positive though overall overdue
  });

  // --- time dimension is day-precise (was month-granular: overdue showed as "em 0 m") ---

  it("flags a custom alert overdue the day after its due date, even within the same month", () => {
    const due = { id: "c1", label: "IPVA", dueKm: null, dueDate: new Date("2026-11-02"), done: false };
    const at = (today: string) => computeAlerts({ ...base, today: new Date(today), customAlerts: [due] }).find((x) => x.id === "c1")!;
    expect(at("2026-11-20")).toMatchObject({ status: "overdue", remainingDays: -18, driver: "time" });
    expect(at("2026-11-02")).toMatchObject({ status: "soon", remainingDays: 0 });
    expect(at("2026-10-03")).toMatchObject({ status: "soon", remainingDays: 30 });
    expect(at("2026-10-02")).toMatchObject({ status: "ok", remainingDays: 31 });
  });

  it("dates a monthly spec rule from the service day, not the calendar month", () => {
    const run = (today: string) =>
      computeAlerts({
        ...base,
        today: new Date(today),
        spec: { brakeFluid: { intervalMonths: 6 } },
        maintenances: [{ category: "FLUIDS", date: new Date("2026-01-01"), km: 80000, specRuleId: "brakeFluid" }],
      }).find((x) => x.id === "brakeFluid")!;
    // due 2026-07-01: on 07-31 it is 30 days late (month-granular math called it "soon")
    expect(run("2026-07-31")).toMatchObject({ status: "overdue", remainingDays: -30 });
    expect(run("2026-06-15")).toMatchObject({ status: "soon", remainingDays: 16 });
  });

  it("clamps month arithmetic to the end of shorter months", () => {
    const a = computeAlerts({
      ...base,
      today: new Date("2026-02-28"),
      spec: { coolant: { intervalMonths: 1 } },
      maintenances: [{ category: "FLUIDS", date: new Date("2026-01-31"), km: 80000, specRuleId: "coolant" }],
    }).find((x) => x.id === "coolant")!;
    expect(a.remainingDays).toBe(0); // 31/01 + 1 month → 28/02
  });

  it("treats a 0 interval as no interval instead of due on the service day", () => {
    const a = computeAlerts({
      ...base,
      today: new Date("2026-11-02"),
      currentKm: 85000,
      spec: { engineOil: { intervalKm: 10000, intervalMonths: 0 } },
      maintenances: [{ category: "OIL", date: new Date("2026-11-01"), km: 84600, specRuleId: null }],
    }).find((x) => x.id === "engineOil")!;
    expect(a).toMatchObject({ status: "ok", driver: "km", remainingDays: null });
  });
});
