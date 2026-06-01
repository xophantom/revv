"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ok, fail, type ActionResult } from "@/lib/result";

const input = z.object({
  label: z.string().min(1, "Descrição obrigatória"),
  dueKm: z.coerce.number().int().min(0).optional(),
  dueDate: z.coerce.date().optional(),
});

export async function createCustomAlert(vehicleId: string, raw: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const v = await db.vehicle.findUnique({ where: { id: vehicleId } });
  if (!v || v.userId !== user.id) return fail("not_found");
  const parsed = input.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { label, dueKm, dueDate } = parsed.data;
  if (dueKm == null && dueDate == null) return fail("informe km ou data");
  const rec = await db.customAlert.create({ data: { vehicleId, label, dueKm, dueDate } });
  revalidatePath(`/garage/${vehicleId}`);
  return ok({ id: rec.id });
}

export async function toggleCustomAlertDone(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const alert = await db.customAlert.findUnique({ where: { id }, include: { vehicle: true } });
  if (!alert || alert.vehicle.userId !== user.id) return fail("not_found");
  await db.customAlert.update({ where: { id }, data: { done: !alert.done } });
  revalidatePath(`/garage/${alert.vehicleId}`);
  return ok(undefined);
}

export async function deleteCustomAlert(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const alert = await db.customAlert.findUnique({ where: { id }, include: { vehicle: true } });
  if (!alert || alert.vehicle.userId !== user.id) return fail("not_found");
  await db.customAlert.delete({ where: { id } });
  revalidatePath(`/garage/${alert.vehicleId}`);
  return ok(undefined);
}
