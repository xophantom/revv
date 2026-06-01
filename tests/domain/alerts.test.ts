import { describe, it, expect } from "vitest";
import { computeAlerts, type AlertInput } from "@/domain/alerts";

const base: AlertInput = {
  currentKm: 87430,
  today: new Date("2026-05-31"),
  spec: { engineOil: { intervalKm: 10000 }, tires: { rotationKm: 10000 } },
  maintenances: [
    { category: "OIL", date: new Date("2026-04-12"), km: 84600 },
    { category: "TIRES", date: new Date("2025-11-03"), km: 80000 },
  ],
  customAlerts: [],
};

describe("computeAlerts", () => {
  it("computes remaining km for oil from last OIL service", () => {
    const a = computeAlerts(base).find((x) => x.id === "engineOil")!;
    expect(a.remainingKm).toBe(7170);
    expect(a.status).toBe("ok");
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
});
