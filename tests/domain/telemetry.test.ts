import { describe, it, expect } from "vitest";
import { computeAlerts, type AlertInput } from "@/domain/alerts";
import { telemetryItems } from "@/domain/telemetry";

const base: AlertInput = {
  currentKm: 50000,
  today: new Date("2026-06-01"),
  spec: {},
  maintenances: [],
  customAlerts: [],
};
const items = (input: Partial<AlertInput>) => {
  const full = { ...base, ...input };
  return telemetryItems(full.spec, computeAlerts(full));
};

describe("telemetryItems", () => {
  it("fills the km gauge from the last service and marks where 'soon' starts", () => {
    const [oil] = items({
      spec: { engineOil: { type: "5W30", brand: "Mobil", capacityL: 4.2, intervalKm: 10000 } },
      maintenances: [{ category: "OIL", date: new Date("2026-03-01"), km: 42000, specRuleIds: [] }],
    });
    expect(oil).toMatchObject({ key: "engineOil", value: "5W30 Mobil", details: ["4,2 L"], interval: "a cada 10.000 km" });
    expect(oil.alert).toMatchObject({ status: "ok", lastKm: 42000 });
    expect(oil.gauge).toEqual({ dim: "km", total: 10000, remaining: 2000, fraction: 0.8, soonAt: 0.85 });
  });

  it("follows the time dimension when it is the one that set the status", () => {
    const [oil] = items({
      spec: { engineOil: { intervalKm: 10000, intervalMonths: 6 } },
      maintenances: [{ category: "OIL", date: new Date("2025-12-10"), km: 49000, specRuleIds: [] }],
    });
    // 1.000 of 10.000 km used, but 6 months from 10/12 ends on 10/06: 9 days left
    expect(oil.alert?.status).toBe("soon");
    expect(oil.gauge).toMatchObject({ dim: "time", total: 182, remaining: 9 });
  });

  it("clamps an overdue gauge to full", () => {
    const [plugs] = items({
      spec: { sparkPlugs: { intervalKm: 30000 } },
      maintenances: [{ category: "ELECTRICAL", date: new Date("2024-01-01"), km: 15000, specRuleIds: ["sparkPlugs"] }],
    });
    expect(plugs.alert?.status).toBe("overdue");
    expect(plugs.gauge).toMatchObject({ remaining: -5000, fraction: 1 });
  });

  it("has no gauge without history, and uses the belt baseline when there is one", () => {
    const out = items({ spec: { airFilter: { intervalKm: 15000 }, timingBelt: { kind: "belt", intervalKm: 60000, lastChangeKm: 20000 } } });
    expect(out.find((i) => i.key === "airFilter")).toMatchObject({ gauge: null, alert: { status: "unknown" } });
    expect(out.find((i) => i.key === "timingBelt")).toMatchObject({ label: "Correia dentada", gauge: { remaining: 30000, fraction: 0.5 } });
  });

  it("folds the oil filter into the oil item, or shows it alone without an interval", () => {
    const [oil] = items({ spec: { engineOil: { type: "5W30" }, oilFilter: { brand: "Tecfil", note: "PSL55" } } });
    expect(oil).toMatchObject({ details: ["filtro Tecfil PSL55"], alert: null, gauge: null, interval: null });
    const [filter] = items({ spec: { oilFilter: { brand: "Tecfil" } } });
    expect(filter).toMatchObject({ key: "oilFilter", value: "Tecfil", alert: null });
  });

  it("describes tires by size and pressure, with the rotation as the interval", () => {
    const [tires] = items({ spec: { tires: { size: "205/55 R16", psiFront: 32, psiRear: 30, rotationKm: 10000 } } });
    expect(tires).toMatchObject({ value: "205/55 R16", details: ["32/30 psi"], interval: "rodízio a cada 10.000 km" });
  });
});
