import { Kpi } from "@/components/dashboard/KpiCards";
import { formatKmPerLiter, formatLiters, type FuelSummary as Summary } from "@/domain/fuel";
import { formatDateOnly } from "@/lib/dates";
import { centsToBRL } from "@/lib/money";

export function FuelSummary({ summary }: { summary: Summary }) {
  const readings = summary.records.filter((r) => r.kmPerLiter != null);
  const last = readings.at(-1);
  const noReading = "precisa de 2 tanques cheios";
  const spent = [formatLiters(summary.totalLiters), summary.avgPricePerLiterCents != null && `média ${centsToBRL(summary.avgPricePerLiterCents)}/L`]
    .filter(Boolean).join(" · ");
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <Kpi
        label="Consumo médio"
        value={summary.avgKmPerLiter == null ? "—" : formatKmPerLiter(summary.avgKmPerLiter)}
        caption={readings.length ? `${readings.length} ${readings.length === 1 ? "medição" : "medições"}` : noReading}
      />
      <Kpi
        label="Último consumo"
        value={last?.kmPerLiter == null ? "—" : formatKmPerLiter(last.kmPerLiter)}
        caption={last ? formatDateOnly(last.date, "dd/MM/yyyy") : noReading}
      />
      <Kpi
        label="Custo por km"
        value={summary.costPerKmCents == null ? "—" : centsToBRL(summary.costPerKmCents)}
        caption="só combustível"
      />
      <Kpi label="Total gasto" value={centsToBRL(summary.totalCents)} caption={spent} />
    </div>
  );
}
