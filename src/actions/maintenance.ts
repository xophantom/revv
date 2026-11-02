"use server";
import { requireUser } from "@/lib/session";
import * as svc from "@/server/maintenance";

export async function createMaintenance(vehicleId: string, raw: unknown) {
  return svc.createMaintenance((await requireUser()).id, vehicleId, raw);
}

export async function updateMaintenance(id: string, raw: unknown) {
  return svc.updateMaintenance((await requireUser()).id, id, raw);
}

export async function deleteMaintenance(id: string) {
  return svc.deleteMaintenance((await requireUser()).id, id);
}
