"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ok, fail, type ActionResult } from "@/lib/result";
import { attachmentInput, attachmentRows } from "@/lib/attachments";
import { deleteBlobs } from "@/lib/blob";

const input = z.object({
  date: z.coerce.date(),
  name: z.string().min(1, "Nome obrigatório"),
  category: z.enum(["EXHAUST", "WHEELS", "ECU", "SUSPENSION", "AESTHETIC", "AUDIO", "BRAKES", "OTHER"]),
  costCents: z.coerce.number().int().min(0).default(0),
  supplier: z.string().optional(),
  notes: z.string().optional(),
  attachments: z.array(attachmentInput).default([]),
});
const updateInput = input.extend({ removeAttachmentIds: z.array(z.string()).default([]) });

function revalidate(vehicleId: string) {
  revalidatePath(`/garage/${vehicleId}`);
  revalidatePath("/dashboard");
}

export async function createUpgrade(vehicleId: string, raw: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const v = await db.vehicle.findUnique({ where: { id: vehicleId } });
  if (!v || v.userId !== user.id) return fail("not_found");
  const parsed = input.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { attachments, ...rest } = parsed.data;
  const rec = await db.upgrade.create({ data: { ...rest, vehicleId, attachments: { create: attachmentRows(attachments, vehicleId) } } });
  revalidate(vehicleId);
  return ok({ id: rec.id });
}

export async function updateUpgrade(id: string, raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const rec = await db.upgrade.findUnique({ where: { id }, include: { vehicle: true, attachments: true } });
  if (!rec || rec.vehicle.userId !== user.id) return fail("not_found");
  const parsed = updateInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { attachments, removeAttachmentIds, ...rest } = parsed.data;
  const removed = rec.attachments.filter((a) => removeAttachmentIds.includes(a.id));
  await db.upgrade.update({
    where: { id },
    data: {
      ...rest,
      attachments: { deleteMany: { id: { in: removed.map((a) => a.id) } }, create: attachmentRows(attachments, rec.vehicleId) },
    },
  });
  await deleteBlobs(removed.map((a) => a.url));
  revalidate(rec.vehicleId);
  return ok(undefined);
}

export async function deleteUpgrade(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const rec = await db.upgrade.findUnique({ where: { id }, include: { vehicle: true, attachments: true } });
  if (!rec || rec.vehicle.userId !== user.id) return fail("not_found");
  await db.upgrade.delete({ where: { id } });
  await deleteBlobs(rec.attachments.map((a) => a.url));
  revalidate(rec.vehicleId);
  return ok(undefined);
}
