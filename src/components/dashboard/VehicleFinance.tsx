"use client";
import { useState } from "react";
import { summarizeFinance, type FinanceEntry, type FinancePeriod } from "@/domain/finance";
import { PeriodSelect } from "./PeriodSelect";
import { FinancePanels } from "./FinancePanels";

type Props = { entries: FinanceEntry[]; currentKm: number; firstKm: number; today: Date };

export function VehicleFinance({ entries, currentKm, firstKm, today }: Props) {
  const [period, setPeriod] = useState<FinancePeriod>("all");
  const summary = summarizeFinance({
    entries,
    today,
    period,
    // Every entry here belongs to this vehicle.
    odometers: [{ vehicleId: entries[0]?.vehicleId ?? "", currentKm, firstKm }],
  });
  return (
    <div className="space-y-3 sm:space-y-4">
      <PeriodSelect value={period} onChange={setPeriod} />
      <FinancePanels summary={summary} period={period} />
    </div>
  );
}
