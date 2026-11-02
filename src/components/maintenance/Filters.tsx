"use client";
import { X } from "lucide-react";
import type { MaintenanceCategory } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { MAINTENANCE_CATEGORIES, MAINTENANCE_LABELS } from "@/lib/categories";
import { MAINTENANCE_ICONS } from "@/lib/category-icons";
import { periodStart as financePeriodStart } from "@/domain/finance";

export const PERIODS = [
  { value: "30d", label: "30d" },
  { value: "6m", label: "6m" },
  { value: "12m", label: "12m" },
  { value: "year", label: "Ano" },
  { value: "all", label: "Tudo" },
] as const;
export type Period = (typeof PERIODS)[number]["value"];
export type MaintFilter = { category: MaintenanceCategory | "all"; period: Period };
export const NO_FILTER: MaintFilter = { category: "all", period: "all" };

// First day ("YYYY-MM-DD") the period includes; null = no limit. Months count like the Financeiro
// tab (whole calendar months), so "6m" lists the same records that tab adds up.
export function periodStart(period: Period, today: string): string | null {
  const d = new Date(today);
  if (period === "30d") return new Date(d.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
  return financePeriodStart(period, d)?.toISOString().slice(0, 10) ?? null;
}

const categoryOptions = [
  { value: "all", label: "Todas as categorias" },
  ...MAINTENANCE_CATEGORIES.map((c) => ({ value: c, label: MAINTENANCE_LABELS[c], icon: MAINTENANCE_ICONS[c] })),
];

export function Filters({ value, onChange }: { value: MaintFilter; onChange: (next: MaintFilter) => void }) {
  const active = value.category !== "all" || value.period !== "all";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select size="sm" className="w-48" aria-label="Categoria" options={categoryOptions}
        value={value.category} onValueChange={(c) => onChange({ ...value, category: c as MaintFilter["category"] })} />
      <Segmented aria-label="Período" options={PERIODS} value={value.period} onChange={(period) => onChange({ ...value, period })} />
      {active && <Button variant="ghost" size="sm" onClick={() => onChange(NO_FILTER)}><X size={13} /> Limpar</Button>}
    </div>
  );
}
