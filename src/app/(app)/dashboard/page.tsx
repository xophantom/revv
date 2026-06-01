import Link from "next/link";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { vehicleSpecSchema, emptySpec } from "@/domain/spec-schema";
import { computeAlerts, type AlertInput } from "@/domain/alerts";
import { summarizeVehicle, type FinanceInput } from "@/domain/finance";
import { centsToBRL } from "@/lib/money";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { SpendOverTime } from "@/components/dashboard/SpendOverTime";
import { CategoryBreakdown } from "@/components/dashboard/CategoryBreakdown";

const STATUS_STYLE: Record<string, string> = {
  overdue: "bg-accent/20 border-accent text-accent",
  soon: "bg-accent/10 border-accent/40 text-accent",
  unknown: "border-border text-muted",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const vehicles = await db.vehicle.findMany({
    where: { userId: user.id },
    include: { maintenances: true, upgrades: true, spec: true, customAlerts: true },
    orderBy: { createdAt: "desc" },
  });

  if (vehicles.length === 0) {
    return (
      <div>
        <h1 className="mb-6 text-3xl font-bold">Dashboard</h1>
        <p className="mono text-sm text-muted">
          // garagem vazia —{" "}
          <Link href="/garage" className="text-accent hover:underline">adicione um veículo</Link>
        </p>
      </div>
    );
  }

  const today = new Date();

  // Per-vehicle finance + a single global FinanceInput (concatenate everything, sum km spans).
  const allMaintenances: { date: Date; costCents: number }[] = [];
  const allUpgrades: { date: Date; costCents: number }[] = [];
  let currentKmSum = 0;
  let firstKmSum = 0;

  const perVehicle = vehicles.map((v) => {
    const firstKm = v.maintenances.length ? Math.min(...v.maintenances.map((m) => m.km)) : v.currentKm;
    const input: FinanceInput = {
      currentKm: v.currentKm,
      firstKm,
      maintenances: v.maintenances.map((m) => ({ date: m.date, costCents: m.costCents })),
      upgrades: v.upgrades.map((u) => ({ date: u.date, costCents: u.costCents })),
    };
    allMaintenances.push(...input.maintenances);
    allUpgrades.push(...input.upgrades);
    currentKmSum += v.currentKm;
    firstKmSum += firstKm;
    return { id: v.id, name: v.name, summary: summarizeVehicle(input) };
  });

  const global = summarizeVehicle({
    currentKm: currentKmSum,
    firstKm: firstKmSum,
    maintenances: allMaintenances,
    upgrades: allUpgrades,
  });
  const globalMonthlyAvg = Math.round(global.totalCents / Math.max(1, global.byMonth.length));

  // Per-vehicle spend list, sorted desc by total.
  const spendList = [...perVehicle].sort((a, b) => b.summary.totalCents - a.summary.totalCents);

  // Aggregated alerts across vehicles (overdue + soon + unknown), most urgent first per vehicle.
  const alertItems = vehicles.flatMap((v) => {
    const spec = v.spec ? vehicleSpecSchema.parse(v.spec.data) : emptySpec();
    const alertInput: AlertInput = {
      currentKm: v.currentKm,
      today,
      spec,
      maintenances: v.maintenances.map((m) => ({ category: m.category, date: m.date, km: m.km, specRuleId: m.specRuleId })),
      customAlerts: v.customAlerts.map((c) => ({ id: c.id, label: c.label, dueKm: c.dueKm, dueDate: c.dueDate, done: c.done })),
    };
    return computeAlerts(alertInput)
      .filter((a) => a.status === "overdue" || a.status === "soon" || a.status === "unknown")
      .map((a) => ({ ...a, vehicleId: v.id, vehicleName: v.name }));
  });
  const RANK: Record<string, number> = { overdue: 0, unknown: 1, soon: 2 };
  alertItems.sort((a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9));
  const topAlerts = alertItems.slice(0, 8);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <KpiCards
        totalCents={global.totalCents}
        monthlyAvgCents={globalMonthlyAvg}
        costPerKmCents={global.costPerKmCents}
        maxExpenseCents={global.maxExpenseCents}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <SpendOverTime byMonth={global.byMonth} />
        <CategoryBreakdown maintenanceCents={global.maintenanceCents} upgradeCents={global.upgradeCents} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mono mb-3 text-[11px] uppercase tracking-wider text-muted">Gastos por veículo</div>
          <ul className="space-y-1">
            {spendList.map((v) => (
              <li key={v.id}>
                <Link href={`/garage/${v.id}`} className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-surface2">
                  <span className="font-medium">{v.name}</span>
                  <span className="mono text-sm text-accent">{centsToBRL(v.summary.totalCents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mono mb-3 text-[11px] uppercase tracking-wider text-muted">Alertas</div>
          {topAlerts.length === 0 ? (
            <p className="mono text-sm text-muted">// tudo em dia</p>
          ) : (
            <ul className="space-y-2">
              {topAlerts.map((a) => (
                <li key={`${a.vehicleId}-${a.source}-${a.id}`}>
                  <Link href={`/garage/${a.vehicleId}`} className={`mono flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] ${STATUS_STYLE[a.status] ?? STATUS_STYLE.unknown}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    <span className="text-fg/80">{a.vehicleName}</span> · {a.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
