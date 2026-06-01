"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ok, fail, type ActionResult } from "@/lib/result";

const vehicleInput = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  plate: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  engine: z.string().optional(),
  color: z.string().optional(),
  currentKm: z.coerce.number().int().min(0).default(0),
  photoKey: z.string().optional(),
  photoUrl: z.string().url().optional(),
});

async function ownedVehicle(id: string, userId: string) {
  const v = await db.vehicle.findUnique({ where: { id } });
  return v && v.userId === userId ? v : null;
}

export async function createVehicle(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = vehicleInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const v = await db.vehicle.create({ data: { ...parsed.data, userId: user.id } });
  revalidatePath("/garage");
  return ok({ id: v.id });
}

export async function updateVehicle(id: string, raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await ownedVehicle(id, user.id))) return fail("not_found");
  const parsed = vehicleInput.partial().safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  await db.vehicle.update({ where: { id }, data: parsed.data });
  revalidatePath(`/garage/${id}`);
  revalidatePath("/garage");
  return ok(undefined);
}

export async function updateKm(id: string, currentKm: number): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await ownedVehicle(id, user.id))) return fail("not_found");
  if (!Number.isInteger(currentKm) || currentKm < 0) return fail("km inválido");
  await db.vehicle.update({ where: { id }, data: { currentKm } });
  revalidatePath(`/garage/${id}`);
  return ok(undefined);
}

export async function deleteVehicle(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await ownedVehicle(id, user.id))) return fail("not_found");
  await db.vehicle.delete({ where: { id } });
  revalidatePath("/garage");
  return ok(undefined);
}
