"use server";
import { requireUser } from "@/lib/session";
import * as svc from "@/server/vehicles";

export async function createVehicle(raw: unknown) {
  return svc.createVehicle((await requireUser()).id, raw);
}

export async function updateVehicle(id: string, raw: unknown) {
  return svc.updateVehicle((await requireUser()).id, id, raw);
}

export async function updateKm(id: string, currentKm: number) {
  return svc.updateKm((await requireUser()).id, id, currentKm);
}

export async function deleteVehicle(id: string) {
  return svc.deleteVehicle((await requireUser()).id, id);
}
