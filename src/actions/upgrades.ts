"use server";
import { requireUser } from "@/lib/session";
import * as svc from "@/server/upgrades";

export async function createUpgrade(vehicleId: string, raw: unknown) {
  return svc.createUpgrade((await requireUser()).id, vehicleId, raw);
}

export async function updateUpgrade(id: string, raw: unknown) {
  return svc.updateUpgrade((await requireUser()).id, id, raw);
}

export async function deleteUpgrade(id: string) {
  return svc.deleteUpgrade((await requireUser()).id, id);
}
