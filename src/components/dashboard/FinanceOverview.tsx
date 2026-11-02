"use client";
import { useState } from "react";
import Link from "next/link";
import { Panel, SectionHeading } from "@/components/ui/panel";
import { summarizeFinance, type FinanceEntry, type FinancePeriod } from "@/domain/finance";
import { centsToBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PeriodSelect } from "./PeriodSelect";
import { FinancePanels } from "./FinancePanels";

export type FinanceVehicle = { id: string; name: string; currentKm: number; firstKm: number };

// Dashboard finance block: one period selector drives the KPIs, both charts and the per-vehicle list.
export function FinanceOverview({ vehicles, entries, today }: { vehicles: FinanceVehicle[]; entries: FinanceEntry[]; today: Date }) {
  const [period, setPeriod] = useState<FinancePeriod>("all");
  const summary = summarizeFinance({
    entries,
    today,
    period,
    odometers: vehicles.map((v) => ({ vehicleId: v.id, currentKm: v.currentKm, firstKm: v.firstKm })),
  });
  const spend = vehicles
    .map((v) => ({ id: v.id, name: v.name, cents: summary.byVehicle[v.id] ?? 0 }))
    .sort((a, b) => b.cents - a.cents);

  return (
    <section className="space-y-3 sm:space-y-4">
      <SectionHeading action={<PeriodSelect value={period} onChange={setPeriod} />}>Financeiro</SectionHeading>
      <FinancePanels summary={summary} period={period} />
      <Panel title="Gastos por veículo">
        <ul className="grid gap-1 sm:grid-cols-2">
          {spend.map((v) => (
            <li key={v.id} className="min-w-0">
              <Link
                href={`/garage/${v.id}`}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span className="min-w-0 truncate font-medium">{v.name}</span>
                <span className={cn("shrink-0 text-sm tabular-nums", !v.cents && "text-muted")}>{centsToBRL(v.cents)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </section>
  );
}
