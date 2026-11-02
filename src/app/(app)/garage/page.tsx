import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { vehicleSpecSchema, emptySpec } from "@/domain/spec-schema";
import { computeAlerts } from "@/domain/alerts";
import { todayDateOnly } from "@/lib/dates";
import { VehicleCard, type VehicleCardStats } from "@/components/vehicles/VehicleCard";
import { VehicleForm } from "@/components/vehicles/VehicleForm";

export const metadata: Metadata = { title: "Garagem" };

const sumCost = (rows: { costCents: number }[]) => rows.reduce((total, r) => total + r.costCents, 0);

export default async function GaragePage() {
  const user = await requireUser();
  // Only the columns the alerts and the spend total read: a vehicle's history can be long.
  const vehicles = await db.vehicle.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      spec: true,
      maintenances: { select: { category: true, date: true, km: true, specRuleIds: true, costCents: true } },
      upgrades: { select: { costCents: true } },
      customAlerts: { select: { id: true, label: true, dueKm: true, dueDate: true, done: true, repeatMonths: true, repeatKm: true } },
      fuelRecords: { select: { costCents: true } },
    },
  });
  const today = todayDateOnly();
  const statsFor = (v: (typeof vehicles)[number]): VehicleCardStats => {
    const alerts = computeAlerts({
      currentKm: v.currentKm,
      today,
      spec: v.spec ? vehicleSpecSchema.parse(v.spec.data) : emptySpec(),
      maintenances: v.maintenances,
      customAlerts: v.customAlerts,
    });
    return {
      overdue: alerts.filter((a) => a.status === "overdue").length,
      soon: alerts.filter((a) => a.status === "soon").length,
      totalCents: sumCost(v.maintenances) + sumCost(v.upgrades) + sumCost(v.fuelRecords),
    };
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Garagem</h1>
        <VehicleForm />
      </div>
      {vehicles.length === 0 ? (
        <p className="text-sm text-muted">Nenhum veículo ainda. Adicione o primeiro</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v, i) => <VehicleCard key={v.id} v={v} stats={statsFor(v)} i={i} />)}
        </div>
      )}
    </div>
  );
}
