"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ok, fail, type ActionResult } from "@/lib/result";

const attachment = z.object({ url: z.string().url(), key: z.string(), fileName: z.string(), mime: z.string(), size: z.number().int() });
const input = z.object({
  date: z.coerce.date(),
  km: z.coerce.number().int().min(0),
  category: z.enum(["OIL", "FILTERS", "BRAKES", "TIRES", "REVISION", "SUSPENSION", "ELECTRICAL", "FLUIDS", "OTHER"]),
  specRuleId: z.string().optional(),
  title: z.string().min(1, "Título obrigatório"),
  workshop: z.string().optional(),
  costCents: z.coerce.number().int().min(0).default(0),
  notes: z.string().optional(),
  attachments: z.array(attachment).default([]),
});

export async function createMaintenance(vehicleId: string, raw: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const v = await db.vehicle.findUnique({ where: { id: vehicleId } });
  if (!v || v.userId !== user.id) return fail("not_found");
  const parsed = input.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { attachments, ...rest } = parsed.data;
  const rec = await db.maintenanceRecord.create({
    data: { ...rest, vehicleId, attachments: { create: attachments.map((a) => ({ ...a, vehicleId, kind: a.mime.includes("pdf") ? ("pdf" as const) : ("image" as const) })) } },
  });
  revalidatePath(`/garage/${vehicleId}`);
  return ok({ id: rec.id });
}

export async function deleteMaintenance(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const rec = await db.maintenanceRecord.findUnique({ where: { id }, include: { vehicle: true } });
  if (!rec || rec.vehicle.userId !== user.id) return fail("not_found");
  await db.maintenanceRecord.delete({ where: { id } });
  revalidatePath(`/garage/${rec.vehicleId}`);
  return ok(undefined);
}
