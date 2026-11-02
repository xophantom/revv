import type { FinancePeriod, FinanceSummary } from "@/domain/finance";
import { KpiCards } from "./KpiCards";
import { SpendOverTime } from "./SpendOverTime";
import { CategoryBreakdown } from "./CategoryBreakdown";

// KPIs + both charts for one summary; shared by the vehicle page and the dashboard.
export function FinancePanels({ summary, period }: { summary: FinanceSummary; period: FinancePeriod }) {
  const emptyLabel = period === "all" ? "// sem gastos registrados" : "// sem gastos no período";
  return (
    <>
      <KpiCards summary={summary} />
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2 lg:items-start">
        <SpendOverTime byMonth={summary.byMonth} emptyLabel={emptyLabel} />
        <CategoryBreakdown
          byCategory={summary.byCategory}
          maintenanceCents={summary.maintenanceCents}
          upgradeCents={summary.upgradeCents}
          fuelCents={summary.fuelCents}
          totalCents={summary.totalCents}
          emptyLabel={emptyLabel}
        />
      </div>
    </>
  );
}
