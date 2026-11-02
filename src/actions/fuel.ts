"use server";
import { requireUser } from "@/lib/session";
import * as svc from "@/server/fuel";

export async function createFuelRecord(vehicleId: string, raw: unknown) {
  return svc.createFuelRecord((await requireUser()).id, vehicleId, raw);
}

export async function updateFuelRecord(id: string, raw: unknown) {
  return svc.updateFuelRecord((await requireUser()).id, id, raw);
}

export async function deleteFuelRecord(id: string) {
  return svc.deleteFuelRecord((await requireUser()).id, id);
}
