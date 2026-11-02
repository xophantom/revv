// Vehicles operations for a given user. Shared by the server actions (session user) and the
// MCP tools (OAuth token user); never import from client code.
import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ok, fail, type ActionResult } from "@/lib/result";
import { blobUrl } from "@/lib/attachments";
import { deleteBlobs } from "@/lib/blob";
import { odometerJumpError } from "@/lib/odometer";

// Blank form fields mean "no value" and store null, so editing can also clear a field.
const blank = (v: unknown) => (v === "" ? null : v);
const text = z.preprocess(blank, z.string().nullish());

const vehicleInput = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  plate: text,
  make: text,
  model: text,
  year: z.preprocess(blank, z.coerce.number().int().min(1900, "Ano inválido").max(2100, "Ano inválido").nullish()),
  engine: text,
  color: text,
  currentKm: z.coerce.number().int().min(0).default(0),
  // null removes the photo; undefined leaves it as is
  photoKey: z.string().nullish(),
  photoUrl: blobUrl.nullish(),
});

// On edit a blank km keeps the odometer: coercing "" would store 0 and reset every km alert.
const updateInput = vehicleInput.extend({
  currentKm: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().min(0).optional()),
});

async function ownedVehicle(id: string, userId: string) {
  const v = await db.vehicle.findUnique({ where: { id } });
  return v && v.userId === userId ? v : null;
}

export async function createVehicle(userId: string, raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = vehicleInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const v = await db.vehicle.create({ data: { ...parsed.data, userId: userId } });
  revalidatePath("/garage");
  return ok({ id: v.id });
}

// Takes the whole form (not a partial, whose missing fields would hit the defaults).
export async function updateVehicle(userId: string, id: string, raw: unknown): Promise<ActionResult> {
  const v = await ownedVehicle(id, userId);
  if (!v) return fail("not_found");
  const parsed = updateInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  await db.vehicle.update({ where: { id }, data: parsed.data });
  if (parsed.data.photoUrl !== undefined && parsed.data.photoUrl !== v.photoUrl) await deleteBlobs([v.photoUrl]);
  revalidatePath(`/garage/${id}`);
  revalidatePath("/garage");
  revalidatePath("/dashboard");
  return ok(undefined);
}

export async function updateKm(userId: string, id: string, currentKm: number): Promise<ActionResult> {
  const v = await ownedVehicle(id, userId);
  if (!v) return fail("not_found");
  if (!Number.isInteger(currentKm) || currentKm < 0) return fail("km inválido");
  const jump = odometerJumpError(v.currentKm, currentKm);
  if (jump) return fail(jump);
  await db.vehicle.update({ where: { id }, data: { currentKm } });
  revalidatePath(`/garage/${id}`);
  return ok(undefined);
}

export async function deleteVehicle(userId: string, id: string): Promise<ActionResult> {
  const v = await ownedVehicle(id, userId);
  if (!v) return fail("not_found");
  const files = await db.attachment.findMany({ where: { vehicleId: id }, select: { url: true } });
  await db.vehicle.delete({ where: { id } }); // cascades to records, alerts and attachment rows
  await deleteBlobs([v.photoUrl, ...files.map((f) => f.url)]);
  // No revalidatePath: it would re-render this (now missing) vehicle's page into the response and
  // flash a 404. The client navigates to /garage, which is dynamic and so fetched fresh anyway.
  return ok(undefined);
}
