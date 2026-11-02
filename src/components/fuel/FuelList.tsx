import type { FuelRecord } from "@prisma/client";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { summarizeFuel } from "@/domain/fuel";
import { ConsumptionChart } from "./ConsumptionChart";
import { FuelForm, type FuelFormProps } from "./FuelForm";
import { FuelRow, type FuelRecordView } from "./FuelRow";
import { FuelSummary } from "./FuelSummary";

type FuelFillRecord = Pick<FuelRecord, "id" | "date" | "km" | "volumeMl" | "costCents" | "fuel" | "fullTank" | "station" | "notes">;

// "Abastecimento" tab. Server-rendered: the readings are computed here and only plain values
// reach the client rows and chart.
export function FuelList({ records, ...form }: FuelFormProps & { records: FuelFillRecord[] }) {
  const summary = summarizeFuel(records);
  const views: FuelRecordView[] = summary.records.map((r) => ({
    id: r.id,
    date: r.date.toISOString(),
    km: r.km,
    volumeMl: r.volumeMl,
    costCents: r.costCents,
    fuel: r.fuel,
    fullTank: r.fullTank,
    station: r.station,
    notes: r.notes,
    pricePerLiterCents: r.pricePerLiterCents,
    kmPerLiter: r.kmPerLiter,
    spanKm: r.span?.km ?? null,
  })).reverse(); // newest first
  const points = summary.records.flatMap((r) => (r.kmPerLiter != null ? [{ date: r.date.toISOString(), kmPerLiter: r.kmPerLiter }] : []));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FuelForm {...form} trigger={<Button><Plus size={16} /> Abastecimento</Button>} />
      </div>
      {views.length === 0 ? (
        <p className="tabular-nums text-sm text-muted">{"// nenhum abastecimento registrado"}</p>
      ) : (
        <>
          <FuelSummary summary={summary} />
          {points.length >= 2 && <ConsumptionChart points={points} average={summary.avgKmPerLiter} />}
          <div className="grid gap-2">
            {views.map((r) => <FuelRow key={r.id} record={r} form={form} />)}
          </div>
        </>
      )}
    </div>
  );
}
