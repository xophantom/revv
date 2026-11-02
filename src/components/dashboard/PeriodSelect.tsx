import { Segmented } from "@/components/ui/segmented";
import type { FinancePeriod } from "@/domain/finance";

const OPTIONS = [
  { value: "6m", label: "6M" },
  { value: "12m", label: "12M" },
  { value: "year", label: "Ano" },
  { value: "all", label: "Tudo" },
] as const satisfies readonly { value: FinancePeriod; label: string }[];

export function PeriodSelect({ value, onChange }: { value: FinancePeriod; onChange: (value: FinancePeriod) => void }) {
  return <Segmented aria-label="Período" value={value} onChange={onChange} options={OPTIONS} />;
}
