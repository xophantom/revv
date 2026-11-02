// Maintenance operations for a given user. Shared by the server actions (session user) and the
// MCP tools (OAuth token user); never import from client code.
import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ok, fail, type ActionResult } from "@/lib/result";
import { odometerJumpError } from "@/lib/odometer";
import { attachmentInput, attachmentRows } from "@/lib/attachments";
import { deleteBlobs } from "@/lib/blob";

const input = z.object({
  date: z.coerce.date(),
  km: z.coerce.number().int().min(0),
  category: z.enum(["OIL", "FILTERS", "BRAKES", "TIRES", "REVISION", "SUSPENSION", "ELECTRICAL", "FLUIDS", "OTHER"]),
  specRuleIds: z.array(z.string()).default([]),
  title: z.string().min(1, "Título obrigatório"),
  workshop: z.string().optional(),
  costCents: z.coerce.number().int().min(0).default(0),
  notes: z.string().optional(),
  attachments: z.array(attachmentInput).default([]),
});
const updateInput = input.extend({ removeAttachmentIds: z.array(z.string()).default([]) });

type Saved = { odometerUpdatedTo: number | null };

// Logging a service past the odometer moves the odometer forward (never back).
// The `lt` guard makes the bump atomic against concurrent km updates.
const bumpOdometer = (vehicleId: string, km: number) =>
  db.vehicle.updateMany({ where: { id: vehicleId, currentKm: { lt: km } }, data: { currentKm: km } });

function revalidate(vehicleId: string) {
  revalidatePath(`/garage/${vehicleId}`);
  revalidatePath("/garage");
  revalidatePath("/dashboard");
}

export async function createMaintenance(userId: string, vehicleId: string, raw: unknown): Promise<ActionResult<{ id: string } & Saved>> {
  const v = await db.vehicle.findUnique({ where: { id: vehicleId } });
  if (!v || v.userId !== userId) return fail("not_found");
  const parsed = input.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { attachments, ...rest } = parsed.data;
  const jump = odometerJumpError(v.currentKm, rest.km);
  if (jump) return fail(jump);
  const [rec, bumped] = await db.$transaction([
    db.maintenanceRecord.create({ data: { ...rest, vehicleId, attachments: { create: attachmentRows(attachments, vehicleId) } } }),
    bumpOdometer(vehicleId, rest.km),
  ]);
  revalidate(vehicleId);
  return ok({ id: rec.id, odometerUpdatedTo: bumped.count ? rest.km : null });
}

export async function updateMaintenance(userId: string, id: string, raw: unknown): Promise<ActionResult<Saved>> {
  const rec = await db.maintenanceRecord.findUnique({ where: { id }, include: { vehicle: true, attachments: true } });
  if (!rec || rec.vehicle.userId !== userId) return fail("not_found");
  const parsed = updateInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { attachments, removeAttachmentIds, ...rest } = parsed.data;
  const jump = odometerJumpError(rec.vehicle.currentKm, rest.km);
  if (jump) return fail(jump);
  const removed = rec.attachments.filter((a) => removeAttachmentIds.includes(a.id));
  const [, bumped] = await db.$transaction([
    db.maintenanceRecord.update({
      where: { id },
      data: {
        ...rest,
        attachments: { deleteMany: { id: { in: removed.map((a) => a.id) } }, create: attachmentRows(attachments, rec.vehicleId) },
      },
    }),
    bumpOdometer(rec.vehicleId, rest.km),
  ]);
  await deleteBlobs(removed.map((a) => a.url));
  revalidate(rec.vehicleId);
  return ok({ odometerUpdatedTo: bumped.count ? rest.km : null });
}

export async function deleteMaintenance(userId: string, id: string): Promise<ActionResult> {
  const rec = await db.maintenanceRecord.findUnique({ where: { id }, include: { vehicle: true, attachments: true } });
  if (!rec || rec.vehicle.userId !== userId) return fail("not_found");
  await db.maintenanceRecord.delete({ where: { id } });
  await deleteBlobs(rec.attachments.map((a) => a.url));
  revalidate(rec.vehicleId);
  return ok(undefined);
}
