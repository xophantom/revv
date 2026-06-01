"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ok, fail, type ActionResult } from "@/lib/result";
import { vehicleSpecSchema } from "@/domain/spec-schema";

export async function upsertSpec(vehicleId: string, raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const v = await db.vehicle.findUnique({ where: { id: vehicleId } });
  if (!v || v.userId !== user.id) return fail("not_found");
  const parsed = vehicleSpecSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  await db.vehicleSpec.upsert({
    where: { vehicleId },
    create: { vehicleId, data: parsed.data },
    update: { data: parsed.data },
  });
  revalidatePath(`/garage/${vehicleId}`);
  return ok(undefined);
}
