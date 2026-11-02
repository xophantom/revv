import "server-only";
import { db } from "@/lib/db";
import { todayDateOnly } from "@/lib/dates";
import { emptySpec, vehicleSpecSchema } from "@/domain/spec-schema";
import { computeAlerts, type AlertInput } from "@/domain/alerts";

// One vehicle with everything the read tools derive from (alerts, finance, fuel).
export function loadVehicle(userId: string, id: string) {
  return db.vehicle.findFirst({
    where: { id, userId },
    include: {
      spec: true,
      maintenances: { orderBy: [{ date: "desc" }, { km: "desc" }], include: { _count: { select: { attachments: true } } } },
      upgrades: { orderBy: { date: "desc" }, include: { _count: { select: { attachments: true } } } },
      fuelRecords: { orderBy: [{ date: "desc" }, { km: "desc" }] },
      customAlerts: { orderBy: { createdAt: "asc" } },
    },
  });
}

export type LoadedVehicle = NonNullable<Awaited<ReturnType<typeof loadVehicle>>>;

export function loadVehicles(userId: string) {
  return db.vehicle.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { spec: true, maintenances: true, upgrades: true, fuelRecords: true, customAlerts: true },
  });
}

export const specOf = (v: { spec: { data: unknown } | null }) => (v.spec ? vehicleSpecSchema.parse(v.spec.data) : emptySpec());

type AlertSource = Parameters<typeof specOf>[0] & {
  currentKm: number;
  maintenances: { category: AlertInput["maintenances"][number]["category"]; date: Date; km: number; specRuleIds: string[] }[];
  customAlerts: { id: string; label: string; dueKm: number | null; dueDate: Date | null; done: boolean; repeatMonths: number | null; repeatKm: number | null }[];
};

// Same inputs the vehicle page and dashboard build.
export function alertsOf(v: AlertSource) {
  return computeAlerts({
    currentKm: v.currentKm,
    today: todayDateOnly(),
    spec: specOf(v),
    maintenances: v.maintenances.map((m) => ({ category: m.category, date: m.date, km: m.km, specRuleIds: m.specRuleIds })),
    customAlerts: v.customAlerts.map((c) => ({
      id: c.id, label: c.label, dueKm: c.dueKm, dueDate: c.dueDate, done: c.done, repeatMonths: c.repeatMonths, repeatKm: c.repeatKm,
    })),
  });
}
