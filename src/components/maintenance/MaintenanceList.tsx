"use client";
import { useUi } from "@/store/ui";
import { Button } from "@/components/ui/button";
import { MaintenanceForm, type MaintenanceFormProps } from "./MaintenanceForm";
import { Filters } from "./Filters";
import { MaintenanceRow, type MaintRecord } from "./MaintenanceRow";

export function MaintenanceList({ records, ...form }: MaintenanceFormProps & { records: MaintRecord[] }) {
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
        <MaintenanceForm {...form} trigger={<Button className="bg-accent text-bg">+ Manutenção</Button>} />
        <Filters />
      </div>
      {filtered.length === 0 ? (
        <p className="mono text-sm text-muted">{records.length ? "// nenhuma manutenção corresponde ao filtro" : "// nenhuma manutenção registrada"}</p>
      ) : (
        <div className="grid gap-2">
          {filtered.map((r) => <MaintenanceRow key={r.id} record={r} form={form} />)}
        </div>
      )}
    </div>
  );
}
