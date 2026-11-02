import { addMonthsUTC, daysBetween } from "@/lib/dates";
import { soonDays, soonKm, type Alert } from "./alerts";
import type { VehicleSpecData } from "./spec-schema";

// One dimension of a service interval, drawn as a progress bar.
export type Gauge = {
  dim: "km" | "time";
  total: number; // interval, in km or days
  remaining: number; // negative when overdue
  fraction: number; // share of the interval used, clamped to 0..1
  soonAt: number; // fraction where "soon" starts
};

// A spec sheet item merged with the state of its service.
export type TelemetryItem = {
  key: string;
  label: string;
  value: string | null; // main spec ("5W30 Mobil")
  details: string[]; // secondary specs ("4,2 L", "32/30 psi")
  interval: string | null; // "a cada 10.000 km ou 12 meses"
  alert: Alert | null; // present when the item has an interval
  gauge: Gauge | null; // null while there's no history
};

const clamp = (n: number) => Math.min(1, Math.max(0, n));

function gauge(dim: Gauge["dim"], total: number, remaining: number): Gauge | null {
  if (!(total > 0)) return null;
  const soon = dim === "km" ? soonKm(total) : soonDays(total);
  return { dim, total, remaining, fraction: clamp((total - remaining) / total), soonAt: clamp(1 - soon / total) };
}

// The bar follows the dimension that set the status; when both are fine, the one closer to due.
export function gaugeFor(a: Alert): Gauge | null {
  const out: Gauge[] = [];
  if (a.intervalKm && a.remainingKm != null) {
    const g = gauge("km", a.intervalKm, a.remainingKm);
    if (g) out.push(g);
  }
  if (a.intervalMonths && a.lastDate && a.remainingDays != null) {
    const g = gauge("time", daysBetween(a.lastDate, addMonthsUTC(a.lastDate, a.intervalMonths)), a.remainingDays);
    if (g) out.push(g);
  }
  const driven = a.status !== "ok" && a.driver ? out.find((g) => g.dim === a.driver) : undefined;
  return driven ?? out.sort((x, y) => y.fraction - x.fraction)[0] ?? null;
}

const km = (n: number) => `${n.toLocaleString("pt-BR")} km`;
const months = (n: number) => (n === 1 ? "1 mês" : `${n} meses`);
const words = (...xs: (string | number | null | undefined | false)[]) => xs.filter((x) => x != null && x !== false && x !== "").join(" ");
function every(intervalKm?: number, intervalMonths?: number): string | null {
  const parts = [intervalKm ? km(intervalKm) : null, intervalMonths ? months(intervalMonths) : null].filter(Boolean);
  return parts.length ? `a cada ${parts.join(" ou ")}` : null;
}

export function telemetryItems(spec: VehicleSpecData, alerts: Alert[]): TelemetryItem[] {
  const byRule = new Map(alerts.filter((a) => a.source === "spec").map((a) => [a.id, a]));
  const items: TelemetryItem[] = [];
  const add = (key: string, label: string, value: string, details: (string | false | undefined)[], interval: string | null) => {
    const alert = byRule.get(key) ?? null;
    items.push({ key, label, value: value || null, details: details.filter((d): d is string => Boolean(d)), interval, alert, gauge: alert ? gaugeFor(alert) : null });
  };

  const { engineOil: oil, oilFilter: filter } = spec;
  const filterText = filter && words(filter.brand, filter.note);
  if (oil) {
    add("engineOil", "Óleo do motor", words(oil.type, oil.brand),
      [oil.capacityL != null && `${String(oil.capacityL).replace(".", ",")} L`, filterText && `filtro ${filterText}`],
      every(oil.intervalKm, oil.intervalMonths));
  } else if (filter) {
    add("oilFilter", "Filtro de óleo", filterText ?? "", [], null);
  }
  if (spec.transmissionOil) add("transmissionOil", "Óleo do câmbio", words(spec.transmissionOil.type), [], every(spec.transmissionOil.intervalKm));
  if (spec.airFilter) add("airFilter", "Filtro de ar", "", [], every(spec.airFilter.intervalKm));
  if (spec.fuelFilter) add("fuelFilter", "Filtro de combustível", "", [], every(spec.fuelFilter.intervalKm));
  if (spec.cabinFilter) add("cabinFilter", "Filtro de cabine", "", [], every(spec.cabinFilter.intervalKm));
  if (spec.timingBelt) {
    const t = spec.timingBelt;
    add("timingBelt", t.kind === "chain" ? "Corrente de comando" : t.kind === "belt" ? "Correia dentada" : "Correia/corrente", "", [], every(t.intervalKm));
  }
  if (spec.tires) {
    const t = spec.tires;
    const psi = t.psiFront != null || t.psiRear != null ? `${t.psiFront ?? "?"}/${t.psiRear ?? "?"} psi` : undefined;
    add("tires", "Pneus", words(t.size), [psi], t.rotationKm ? `rodízio a cada ${km(t.rotationKm)}` : null);
  }
  if (spec.sparkPlugs) add("sparkPlugs", "Velas", words(spec.sparkPlugs.type), [], every(spec.sparkPlugs.intervalKm));
  if (spec.brakeFluid) add("brakeFluid", "Fluido de freio", words(spec.brakeFluid.type), [], every(undefined, spec.brakeFluid.intervalMonths));
  if (spec.coolant) add("coolant", "Arrefecimento", words(spec.coolant.type), [], every(undefined, spec.coolant.intervalMonths));
  return items;
}
