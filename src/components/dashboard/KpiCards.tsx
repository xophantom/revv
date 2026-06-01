import { centsToBRL } from "@/lib/money";

type Props = {
  totalCents: number;
  monthlyAvgCents: number;
  costPerKmCents: number | null;
  maxExpenseCents: number;
};

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mono text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

export function KpiCards({ totalCents, monthlyAvgCents, costPerKmCents, maxExpenseCents }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card label="Total gasto" value={centsToBRL(totalCents)} />
      <Card label="Média mensal" value={centsToBRL(monthlyAvgCents)} />
      <Card label="Custo por km" value={costPerKmCents == null ? "—" : centsToBRL(costPerKmCents)} />
      <Card label="Maior despesa" value={centsToBRL(maxExpenseCents)} />
    </div>
  );
}
