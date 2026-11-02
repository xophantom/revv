import type { MaintenanceCategory } from "@prisma/client";
import type { VehicleSpecData } from "./spec-schema";
import { addMonthsUTC, daysBetween } from "@/lib/dates";

export const KM_SOON = 1500;
export const DAYS_SOON = 30;

export type AlertStatus = "overdue" | "unknown" | "soon" | "ok";
export type AlertDriver = "km" | "time" | null;

export type Alert = {
  id: string;
  label: string;
  status: AlertStatus;
  remainingKm: number | null;
  remainingDays: number | null; // calendar days until due (negative = overdue)
  driver: AlertDriver; // which dimension set the status (so the UI shows the right number)
  source: "spec" | "custom";
  intervalKm: number | null; // spec rules only
  intervalMonths: number | null;
  lastKm: number | null; // odometer at the last service (or the explicit baseline)
  lastDate: Date | null; // date of the last service
};

type SpecRule = {
  id: string;
  label: string;
  category: MaintenanceCategory;
  intervalKm?: number;
  intervalMonths?: number;
  baselineKm?: number; // explicit baseline (e.g. timingBelt.lastChangeKm) when no service is logged
  byCategory?: boolean; // an untagged record of this category counts as this service (see lastServiceFor)
};

export type MaintenanceLite = {
  category: MaintenanceCategory;
  date: Date;
  km: number;
  specRuleIds: string[]; // spec rules this record serviced; disambiguates shared categories
};

export type CustomAlertLite = { id: string; label: string; dueKm: number | null; dueDate: Date | null; done: boolean };

export type AlertInput = {
  currentKm: number;
  today: Date;
  spec: VehicleSpecData;
  maintenances: MaintenanceLite[];
  customAlerts: CustomAlertLite[];
};

function rulesFromSpec(spec: VehicleSpecData): SpecRule[] {
  const r: SpecRule[] = [];
  if (spec.engineOil?.intervalKm || spec.engineOil?.intervalMonths)
    r.push({ id: "engineOil", label: "Troca de óleo", category: "OIL", intervalKm: spec.engineOil.intervalKm, intervalMonths: spec.engineOil.intervalMonths, byCategory: true });
  if (spec.transmissionOil?.intervalKm)
    r.push({ id: "transmissionOil", label: "Óleo do câmbio", category: "FLUIDS", intervalKm: spec.transmissionOil.intervalKm });
  if (spec.tires?.rotationKm) r.push({ id: "tires", label: "Rodízio de pneus", category: "TIRES", intervalKm: spec.tires.rotationKm, byCategory: true });
  if (spec.brakeFluid?.intervalMonths) r.push({ id: "brakeFluid", label: "Fluido de freio", category: "FLUIDS", intervalMonths: spec.brakeFluid.intervalMonths });
  if (spec.coolant?.intervalMonths) r.push({ id: "coolant", label: "Arrefecimento", category: "FLUIDS", intervalMonths: spec.coolant.intervalMonths });
  if (spec.sparkPlugs?.intervalKm) r.push({ id: "sparkPlugs", label: "Velas", category: "ELECTRICAL", intervalKm: spec.sparkPlugs.intervalKm });
  if (spec.airFilter?.intervalKm) r.push({ id: "airFilter", label: "Filtro de ar", category: "FILTERS", intervalKm: spec.airFilter.intervalKm });
  if (spec.fuelFilter?.intervalKm) r.push({ id: "fuelFilter", label: "Filtro de combustível", category: "FILTERS", intervalKm: spec.fuelFilter.intervalKm });
  if (spec.cabinFilter?.intervalKm) r.push({ id: "cabinFilter", label: "Filtro de cabine", category: "FILTERS", intervalKm: spec.cabinFilter.intervalKm });
  if (spec.timingBelt?.intervalKm) r.push({ id: "timingBelt", label: "Correia/corrente", category: "REVISION", intervalKm: spec.timingBelt.intervalKm, baselineKm: spec.timingBelt.lastChangeKm });
  return r;
}

export type SpecRuleOption = { id: string; label: string; category: MaintenanceCategory; byCategory: boolean };

export function specRuleOptions(spec: VehicleSpecData): SpecRuleOption[] {
  return rulesFromSpec(spec).map((r) => ({ id: r.id, label: r.label, category: r.category, byCategory: Boolean(r.byCategory) }));
}

const RANK: Record<AlertStatus, number> = { overdue: 0, unknown: 1, soon: 2, ok: 3 };

function classifyDim(remaining: number, soonThreshold: number): AlertStatus {
  if (!Number.isFinite(remaining)) return "unknown"; // invalid date / NaN never silently passes as ok
  if (remaining < 0) return "overdue";
  if (remaining <= soonThreshold) return "soon";
  return "ok";
}

// Newest maintenance that services this rule: records tagged with the rule id, plus untagged
// records of its category when the rule is byCategory (oil, tires: the category can't mean anything
// else). Elsewhere an untagged record is ignored: a FILTERS or FLUIDS record would cross-contaminate
// sibling rules, and an untagged REVISION or ELECTRICAL one says nothing about the belt or the plugs.
// A tagged record counts only for the rules it lists, so a multi-item revision never resets a sibling.
function lastServiceFor(rule: SpecRule, maint: MaintenanceLite[]): MaintenanceLite | undefined {
  const pool = maint.filter((m) =>
    m.specRuleIds.includes(rule.id) || (rule.byCategory && !m.specRuleIds.length && m.category === rule.category));
  return pool.sort((a, b) => b.date.getTime() - a.date.getTime())[0];
}

type Dim = { status: AlertStatus; dim: "km" | "time" };

function combine(dims: Dim[]): { status: AlertStatus; driver: AlertDriver } {
  if (!dims.length) return { status: "unknown", driver: null };
  const worst = [...dims].sort((a, b) => RANK[a.status] - RANK[b.status])[0];
  if (worst.status === "unknown") return { status: "unknown", driver: null };
  return { status: worst.status, driver: worst.dim };
}

// Smaller = more urgent. Normalizes days to a km-comparable scale so the two dimensions sort together.
function urgencyKey(a: Alert): number {
  const vals: number[] = [];
  if (a.remainingKm != null && Number.isFinite(a.remainingKm)) vals.push(a.remainingKm);
  if (a.remainingDays != null && Number.isFinite(a.remainingDays)) vals.push(a.remainingDays * (KM_SOON / DAYS_SOON));
  return vals.length ? Math.min(...vals) : Number.POSITIVE_INFINITY;
}

export function computeAlerts(input: AlertInput): Alert[] {
  const rules = rulesFromSpec(input.spec);
  const alerts: Alert[] = [];

  for (const rule of rules) {
    const last = lastServiceFor(rule, input.maintenances);
    let remainingKm: number | null = null;
    let remainingDays: number | null = null;
    const dims: Dim[] = [];

    if (rule.intervalKm) {
      const baseKm = last?.km ?? rule.baselineKm;
      if (baseKm != null) {
        remainingKm = rule.intervalKm - (input.currentKm - baseKm);
        dims.push({ status: classifyDim(remainingKm, KM_SOON), dim: "km" });
      } else {
        dims.push({ status: "unknown", dim: "km" }); // no service logged and no explicit baseline
      }
    }
    if (rule.intervalMonths) {
      if (last?.date) {
        remainingDays = daysBetween(input.today, addMonthsUTC(last.date, rule.intervalMonths));
        dims.push({ status: classifyDim(remainingDays, DAYS_SOON), dim: "time" });
      } else {
        dims.push({ status: "unknown", dim: "time" });
      }
    }

    const { status, driver } = combine(dims);
    alerts.push({
      id: rule.id, label: rule.label, status, remainingKm, remainingDays, driver, source: "spec",
      intervalKm: rule.intervalKm ?? null, intervalMonths: rule.intervalMonths ?? null,
      lastKm: last?.km ?? rule.baselineKm ?? null, lastDate: last?.date ?? null,
    });
  }

  for (const c of input.customAlerts) {
    if (c.done) continue;
    const remainingKm = c.dueKm != null ? c.dueKm - input.currentKm : null;
    const remainingDays = c.dueDate != null ? daysBetween(input.today, c.dueDate) : null;
    const dims: Dim[] = [];
    if (remainingKm != null) dims.push({ status: classifyDim(remainingKm, KM_SOON), dim: "km" });
    if (remainingDays != null) dims.push({ status: classifyDim(remainingDays, DAYS_SOON), dim: "time" });
    const { status, driver } = combine(dims);
    alerts.push({
      id: c.id, label: c.label, status, remainingKm, remainingDays, driver, source: "custom",
      intervalKm: null, intervalMonths: null, lastKm: null, lastDate: null,
    });
  }

  // primary: status severity; secondary: most urgent first within the same status.
  return alerts.sort((a, b) => RANK[a.status] - RANK[b.status] || urgencyKey(a) - urgencyKey(b));
}
