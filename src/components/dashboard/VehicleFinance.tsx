"use client";
import type { FinanceSummary } from "@/domain/finance";
import { KpiCards } from "./KpiCards";
import { SpendOverTime } from "./SpendOverTime";
import { CategoryBreakdown } from "./CategoryBreakdown";

type Props = { summary: FinanceSummary };

export function VehicleFinance({ summary }: Props) {
  return (
    <div className="space-y-5">
      <KpiCards
        totalCents={summary.totalCents}
        monthlyAvgCents={summary.monthlyAvgCents}
        costPerKmCents={summary.costPerKmCents}
        maxExpenseCents={summary.maxExpenseCents}
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <SpendOverTime byMonth={summary.byMonth} />
        <CategoryBreakdown maintenanceCents={summary.maintenanceCents} upgradeCents={summary.upgradeCents} />
      </div>
    </div>
  );
}
