"use server";
import { requireUser } from "@/lib/session";
import * as svc from "@/server/alerts";
export type { ToggleResult, ToggleSeen } from "@/server/alerts";
import type { ToggleSeen } from "@/server/alerts";

export async function createCustomAlert(vehicleId: string, raw: unknown) {
  return svc.createCustomAlert((await requireUser()).id, vehicleId, raw);
}

export async function updateCustomAlert(id: string, raw: unknown) {
  return svc.updateCustomAlert((await requireUser()).id, id, raw);
}

export async function toggleCustomAlertDone(id: string, seen: ToggleSeen) {
  return svc.toggleCustomAlertDone((await requireUser()).id, id, seen);
}

export async function deleteCustomAlert(id: string) {
  return svc.deleteCustomAlert((await requireUser()).id, id);
}
