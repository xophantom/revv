"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { todayInputValue } from "@/lib/dates";
import { MaintenanceForm, type MaintenanceFormProps } from "./MaintenanceForm";
import { Filters, NO_FILTER, periodStart, type MaintFilter } from "./Filters";
import { MaintenanceRow, type MaintRecord } from "./MaintenanceRow";

export function MaintenanceList({ records, ...form }: MaintenanceFormProps & { records: MaintRecord[] }) {
  // Local, so it starts clean on every vehicle.
  const [filter, setFilter] = useState<MaintFilter>(NO_FILTER);
  const from = periodStart(filter.period, todayInputValue());
  const filtered = records.filter((r) =>
    (filter.category === "all" || r.category === filter.category) && (!from || r.date.slice(0, 10) >= from));
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MaintenanceForm {...form} trigger={<Button><Plus size={16} /> Manutenção</Button>} />
        {records.length > 0 && <Filters value={filter} onChange={setFilter} />}
      </div>
      {filtered.length === 0 ? (
        <p className="tabular-nums text-sm text-muted">{records.length ? "// nenhuma manutenção corresponde ao filtro" : "// nenhuma manutenção registrada"}</p>
      ) : (
        <div className="grid gap-2">
          {filtered.map((r) => <MaintenanceRow key={r.id} record={r} form={form} />)}
        </div>
      )}
    </div>
  );
}
