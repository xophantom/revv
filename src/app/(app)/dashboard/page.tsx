import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { vehicleSpecSchema, emptySpec } from "@/domain/spec-schema";
import { computeAlerts, type Alert, type AlertInput } from "@/domain/alerts";
import { firstLoggedKm, toFinanceEntries } from "@/domain/finance";
import { alertDetail } from "@/lib/alert-text";
import { todayDateOnly } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";
import { StatusBadge, STATUS_TONE } from "@/components/ui/status-badge";
import { FinanceOverview } from "@/components/dashboard/FinanceOverview";

type VehicleAlert = Alert & { vehicleId: string; vehicleName: string };

const alertHref = (a: VehicleAlert) =>
  a.source === "spec" ? `/garage/${a.vehicleId}?registrar=${encodeURIComponent(a.id)}` : `/garage/${a.vehicleId}#alertas`;
const alertKey = (a: VehicleAlert) => `${a.vehicleId}-${a.source}-${a.id}`;

function alertCounts(urgent: VehicleAlert[]): string {
  const overdue = urgent.filter((a) => a.status === "overdue").length;
  const soon = urgent.length - overdue;
  return [overdue && `${overdue} ${overdue === 1 ? "atrasado" : "atrasados"}`, soon && `${soon} em breve`].filter(Boolean).join(" · ");
}

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
          {"// garagem vazia — "}
          <Link href="/garage" className="text-accent hover:underline">adicione um veículo</Link>
        </p>
      </div>
    );
  }

  const today = todayDateOnly();
  const entries = vehicles.flatMap(toFinanceEntries);
  const financeVehicles = vehicles.map((v) => ({ id: v.id, name: v.name, currentKm: v.currentKm, firstKm: firstLoggedKm(v) }));

  const alerts: VehicleAlert[] = vehicles.flatMap((v) => {
    const spec = v.spec ? vehicleSpecSchema.parse(v.spec.data) : emptySpec();
    const alertInput: AlertInput = {
      currentKm: v.currentKm,
      today,
      spec,
      maintenances: v.maintenances.map((m) => ({ category: m.category, date: m.date, km: m.km, specRuleIds: m.specRuleIds })),
      customAlerts: v.customAlerts.map((c) => ({ id: c.id, label: c.label, dueKm: c.dueKm, dueDate: c.dueDate, done: c.done })),
    };
    return computeAlerts(alertInput).map((a) => ({ ...a, vehicleId: v.id, vehicleName: v.name }));
  });
  // Overdue before soon; the stable sort keeps each vehicle's own urgency order.
  const urgent = alerts
    .filter((a) => a.status === "overdue" || a.status === "soon")
    .sort((a, b) => Number(a.status === "soon") - Number(b.status === "soon"));
  // No service logged yet: a setup gap, not an urgency, so it sits apart and collapsed.
  const missing = alerts.filter((a) => a.status === "unknown");

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <Panel title="Alertas" action={urgent.length > 0 && <span className="mono text-[11px] text-muted">{alertCounts(urgent)}</span>}>
        {urgent.length === 0 ? (
          <p className="mono text-sm text-muted">{missing.length ? "// nada atrasado ou próximo" : "// tudo em dia"}</p>
        ) : (
          <ul className="grid gap-1 md:grid-cols-2">
            {urgent.map((a) => (
              <li key={alertKey(a)} className="min-w-0">
                <Link
                  href={alertHref(a)}
                  className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <StatusBadge status={a.status} />
                  <span className="min-w-0 text-sm">
                    <span className="text-muted">{a.vehicleName}</span> · {a.label}
                    <span className="mono ml-2 text-[11px] text-muted">{alertDetail(a)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {missing.length > 0 && (
          <details className="group mt-3 border-t border-border pt-3">
            <summary className="mono flex cursor-pointer list-none flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted transition-colors hover:text-fg [&::-webkit-details-marker]:hidden">
              <ChevronRight size={12} aria-hidden className="shrink-0 transition-transform group-open:rotate-90" />
              <span>Sem histórico · {missing.length}</span>
              <span className="text-muted/70">— registre o último serviço para acompanhar</span>
            </summary>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {missing.map((a) => (
                <li key={alertKey(a)} className="max-w-full">
                  <Link
                    href={alertHref(a)}
                    className={cn(
                      "mono inline-flex max-w-full rounded-md border px-2 py-1 text-[11px] transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-accent",
                      STATUS_TONE.unknown,
                    )}
                  >
                    <span className="truncate">{a.vehicleName} · {a.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Panel>

      <FinanceOverview vehicles={financeVehicles} entries={entries} today={today} />
    </div>
  );
}
