import Link from "next/link";
import type { VehicleSpecData } from "@/domain/spec-schema";

type Cell = { key: string; value: string; interval?: string };

const km = (n?: number) => (n != null ? `${n.toLocaleString("pt-BR")}km` : "");

function buildCells(spec: VehicleSpecData): Cell[] {
  const cells: Cell[] = [];

  if (spec.engineOil) {
    const o = spec.engineOil;
    const value = `${o.type ?? ""} ${o.brand ?? ""}`.trim();
    const interval =
      `${o.capacityL != null ? o.capacityL + "L · " : ""}` +
      `${o.intervalKm != null ? km(o.intervalKm) : ""}` +
      `${o.intervalMonths != null ? " / " + o.intervalMonths + "m" : ""}`;
    cells.push({ key: "Óleo motor", value: value || "—", interval: interval.trim() || undefined });
  }

  if (spec.oilFilter) {
    const o = spec.oilFilter;
    cells.push({ key: "Filtro de óleo", value: [o.brand, o.note].filter(Boolean).join(" · ") || "—" });
  }

  if (spec.transmissionOil) {
    const o = spec.transmissionOil;
    cells.push({ key: "Óleo câmbio", value: o.type ?? "—", interval: o.intervalKm != null ? km(o.intervalKm) : undefined });
  }

  if (spec.airFilter) {
    cells.push({ key: "Filtro de ar", value: "—", interval: spec.airFilter.intervalKm != null ? km(spec.airFilter.intervalKm) : undefined });
  }
  if (spec.fuelFilter) {
    cells.push({ key: "Filtro de combustível", value: "—", interval: spec.fuelFilter.intervalKm != null ? km(spec.fuelFilter.intervalKm) : undefined });
  }
  if (spec.cabinFilter) {
    cells.push({ key: "Filtro de cabine", value: "—", interval: spec.cabinFilter.intervalKm != null ? km(spec.cabinFilter.intervalKm) : undefined });
  }

  if (spec.timingBelt) {
    const t = spec.timingBelt;
    cells.push({ key: "Correia", value: t.kind === "chain" ? "Corrente" : "Correia", interval: t.intervalKm != null ? km(t.intervalKm) : undefined });
  }

  if (spec.tires) {
    const t = spec.tires;
    const interval =
      `${t.psiFront != null || t.psiRear != null ? `${t.psiFront ?? "?"}/${t.psiRear ?? "?"} psi` : ""}` +
      `${t.rotationKm != null ? `${t.psiFront != null || t.psiRear != null ? " · " : ""}rodízio ${km(t.rotationKm)}` : ""}`;
    cells.push({ key: "Pneus", value: t.size ?? "—", interval: interval || undefined });
  }

  if (spec.sparkPlugs) {
    const s = spec.sparkPlugs;
    cells.push({ key: "Velas", value: s.type ?? "—", interval: s.intervalKm != null ? km(s.intervalKm) : undefined });
  }

  if (spec.brakeFluid) {
    const b = spec.brakeFluid;
    cells.push({ key: "Fluido freio", value: b.type ?? "—", interval: b.intervalMonths != null ? `${b.intervalMonths}m` : undefined });
  }

  if (spec.coolant) {
    const c = spec.coolant;
    cells.push({ key: "Arrefecimento", value: c.type ?? "—", interval: c.intervalMonths != null ? `${c.intervalMonths}m` : undefined });
  }

  return cells;
}

export function SpecSheet({ vehicleId, spec }: { vehicleId: string; spec: VehicleSpecData }) {
  const cells = buildCells(spec);
  const isEmpty = cells.length === 0 && !spec.freeNotes;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="mono text-xs tracking-widest text-accent">// FICHA DE TROCA</span>
        <Link href={`/garage/${vehicleId}/spec/edit`} className="text-xs text-accent transition hover:opacity-80">editar</Link>
      </div>

      {isEmpty ? (
        <p className="mono text-sm text-muted">// ficha não preenchida —</p>
      ) : (
        <>
          {cells.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              {cells.map((c) => (
                <div key={c.key} className="rounded-[10px] border border-border bg-surface p-3">
                  <div className="mono text-[10px] uppercase tracking-wide text-muted">{c.key}</div>
                  <div className="mt-1 font-bold">{c.value}</div>
                  {c.interval && <div className="mono mt-0.5 text-[11px] text-accent">{c.interval}</div>}
                </div>
              ))}
            </div>
          )}
          {spec.freeNotes && (
            <div className="mono mt-3 rounded-lg border border-dashed border-border p-3 text-[11px] text-muted">📌 {spec.freeNotes}</div>
          )}
        </>
      )}
    </div>
  );
}
