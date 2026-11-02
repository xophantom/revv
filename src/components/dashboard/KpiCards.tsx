import { Panel } from "@/components/ui/panel";
import { expenseLabel, shortMonthLabel, type FinanceSummary } from "@/domain/finance";
import { centsToBRL } from "@/lib/money";

export function Kpi({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <Panel title={label} className="min-w-0 p-3 sm:p-4">
      <div className="text-lg font-bold tabular-nums wrap-anywhere sm:text-2xl">{value}</div>
      <div className="tabular-nums mt-1 line-clamp-2 text-[11px] text-muted wrap-break-word" title={caption}>{caption}</div>
    </Panel>
  );
}

function rangeCaption(byMonth: FinanceSummary["byMonth"]): string {
  if (!byMonth.length) return "sem registros";
  const first = shortMonthLabel(byMonth[0].month);
  const last = shortMonthLabel(byMonth[byMonth.length - 1].month);
  return first === last ? first : `${first} – ${last}`;
}

export function KpiCards({ summary }: { summary: FinanceSummary }) {
  const months = summary.byMonth.length;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <Kpi label="Total gasto" value={centsToBRL(summary.totalCents)} caption={rangeCaption(summary.byMonth)} />
      <Kpi
        label="Média mensal"
        value={centsToBRL(summary.monthlyAvgCents)}
        caption={months ? `÷ ${months} ${months === 1 ? "mês" : "meses"}` : "sem registros"}
      />
      <Kpi
        label="Custo por km"
        value={summary.costPerKmCents == null ? "—" : centsToBRL(summary.costPerKmCents)}
        caption="todo o histórico"
      />
      <Kpi
        label="Maior despesa"
        value={summary.maxExpense ? centsToBRL(summary.maxExpense.costCents) : "—"}
        caption={summary.maxExpense ? expenseLabel(summary.maxExpense) : "sem registros"}
      />
    </div>
  );
}
