"use server";
import { requireUser } from "@/lib/session";
import * as svc from "@/server/spec";

export async function upsertSpec(vehicleId: string, raw: unknown) {
  return svc.upsertSpec((await requireUser()).id, vehicleId, raw);
}
