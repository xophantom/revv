import type { MaintenanceCategory } from "@prisma/client";
import type { VehicleSpecData } from "./spec-schema";

const KM_SOON = 1500;
const MONTHS_SOON = 1;

export type AlertStatus = "ok" | "soon" | "overdue";
export type Alert = {
  id: string;
  label: string;
  status: AlertStatus;
  remainingKm: number | null;
  remainingMonths: number | null;
  source: "spec" | "custom";
};

type SpecRule = { id: string; label: string; category: MaintenanceCategory; intervalKm?: number; intervalMonths?: number };

export type AlertInput = {
  currentKm: number;
  today: Date;
  spec: VehicleSpecData;
  maintenances: { category: MaintenanceCategory; date: Date; km: number }[];
  customAlerts: { id: string; label: string; dueKm: number | null; dueDate: Date | null; done: boolean }[];
};

function rulesFromSpec(spec: VehicleSpecData): SpecRule[] {
  const r: SpecRule[] = [];
  if (spec.engineOil?.intervalKm || spec.engineOil?.intervalMonths)
    r.push({ id: "engineOil", label: "Troca de óleo", category: "OIL", intervalKm: spec.engineOil.intervalKm, intervalMonths: spec.engineOil.intervalMonths });
  if (spec.tires?.rotationKm) r.push({ id: "tires", label: "Rodízio de pneus", category: "TIRES", intervalKm: spec.tires.rotationKm });
  if (spec.brakeFluid?.intervalMonths) r.push({ id: "brakeFluid", label: "Fluido de freio", category: "FLUIDS", intervalMonths: spec.brakeFluid.intervalMonths });
  if (spec.coolant?.intervalMonths) r.push({ id: "coolant", label: "Arrefecimento", category: "FLUIDS", intervalMonths: spec.coolant.intervalMonths });
  if (spec.sparkPlugs?.intervalKm) r.push({ id: "sparkPlugs", label: "Velas", category: "ELECTRICAL", intervalKm: spec.sparkPlugs.intervalKm });
  if (spec.airFilter?.intervalKm) r.push({ id: "airFilter", label: "Filtro de ar", category: "FILTERS", intervalKm: spec.airFilter.intervalKm });
  if (spec.fuelFilter?.intervalKm) r.push({ id: "fuelFilter", label: "Filtro de combustível", category: "FILTERS", intervalKm: spec.fuelFilter.intervalKm });
  if (spec.cabinFilter?.intervalKm) r.push({ id: "cabinFilter", label: "Filtro de cabine", category: "FILTERS", intervalKm: spec.cabinFilter.intervalKm });
  if (spec.timingBelt?.intervalKm) r.push({ id: "timingBelt", label: "Correia/corrente", category: "REVISION", intervalKm: spec.timingBelt.intervalKm });
  return r;
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function statusFrom(remainingKm: number | null, remainingMonths: number | null): AlertStatus {
  const overdue = (remainingKm !== null && remainingKm < 0) || (remainingMonths !== null && remainingMonths < 0);
  if (overdue) return "overdue";
  const soon = (remainingKm !== null && remainingKm <= KM_SOON) || (remainingMonths !== null && remainingMonths <= MONTHS_SOON);
  return soon ? "soon" : "ok";
}

const RANK: Record<AlertStatus, number> = { overdue: 0, soon: 1, ok: 2 };

export function computeAlerts(input: AlertInput): Alert[] {
  const alerts: Alert[] = [];
  for (const rule of rulesFromSpec(input.spec)) {
    const last = input.maintenances
      .filter((m) => m.category === rule.category)
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
    let remainingKm: number | null = null;
    let remainingMonths: number | null = null;
    if (rule.intervalKm != null) {
      const baseKm = last?.km ?? input.currentKm;
      remainingKm = rule.intervalKm - (input.currentKm - baseKm);
    }
    if (rule.intervalMonths != null) {
      const baseDate = last?.date ?? input.today;
      remainingMonths = rule.intervalMonths - monthsBetween(baseDate, input.today);
    }
    alerts.push({ id: rule.id, label: rule.label, status: statusFrom(remainingKm, remainingMonths), remainingKm, remainingMonths, source: "spec" });
  }
  for (const c of input.customAlerts) {
    if (c.done) continue;
    const remainingKm = c.dueKm != null ? c.dueKm - input.currentKm : null;
    const remainingMonths = c.dueDate != null ? monthsBetween(input.today, c.dueDate) : null;
    alerts.push({ id: c.id, label: c.label, status: statusFrom(remainingKm, remainingMonths), remainingKm, remainingMonths, source: "custom" });
  }
  return alerts.sort((a, b) => RANK[a.status] - RANK[b.status]);
}
