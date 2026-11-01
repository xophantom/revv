"use client";
import { useUi } from "@/store/ui";
import { MaintenanceForm } from "./MaintenanceForm";
import { Filters } from "./Filters";
import { MaintenanceRow, type MaintRecord } from "./MaintenanceRow";

export function MaintenanceList({ vehicleId, specRules, records, currentKm }: { vehicleId: string; specRules: { id: string; label: string }[]; records: MaintRecord[]; currentKm: number }) {
  const { maintFilter } = useUi();
  const filtered = records.filter((r) => {
    if (maintFilter.category && r.category !== maintFilter.category) return false;
    const date = r.date.slice(0, 10);
    if (maintFilter.from && date < maintFilter.from) return false;
    if (maintFilter.to && date > maintFilter.to) return false;
    return true;
  });
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MaintenanceForm vehicleId={vehicleId} specRules={specRules} currentKm={currentKm} />
        <Filters />
      </div>
      {filtered.length === 0 ? (
        <p className="mono text-sm text-muted">{"// nenhuma manutenção registrada"}</p>
      ) : (
        <div className="grid gap-2">
          {filtered.map((r) => <MaintenanceRow key={r.id} record={r} />)}
        </div>
      )}
    </div>
  );
}
