"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ok, fail, type ActionResult } from "@/lib/result";
import { odometerJumpError } from "@/lib/odometer";

const optionalText = z.string().trim().optional().transform((v) => v || null);

const input = z.object({
  date: z.coerce.date({ error: "Data inválida" }),
  km: z.coerce.number().int("Km deve ser um número inteiro").min(0, "Km inválido").max(9_999_999, "Km inválido"),
  // Liters × 1000; the cap only keeps a typo from overflowing the Int column.
  volumeMl: z.coerce.number().int().positive("Informe os litros").max(2_000_000, "Volume grande demais"),
  costCents: z.coerce.number().int().min(0).max(100_000_000, "Valor grande demais").default(0),
  fuel: z.enum(["GASOLINE", "ETHANOL", "DIESEL", "OTHER"]).default("GASOLINE"),
  fullTank: z.boolean().default(true),
  station: optionalText,
  notes: optionalText,
});

type Saved = { odometerUpdatedTo: number | null };

// A fill past the odometer moves it forward (never back), atomically like maintenance.
const bumpOdometer = (vehicleId: string, km: number) =>
  db.vehicle.updateMany({ where: { id: vehicleId, currentKm: { lt: km } }, data: { currentKm: km } });

function revalidate(vehicleId: string) {
  revalidatePath(`/garage/${vehicleId}`);
  revalidatePath("/garage"); // odometer on the garage cards
  revalidatePath("/dashboard");
}

export async function createFuelRecord(vehicleId: string, raw: unknown): Promise<ActionResult<{ id: string } & Saved>> {
  const user = await requireUser();
  const v = await db.vehicle.findUnique({ where: { id: vehicleId } });
  if (!v || v.userId !== user.id) return fail("not_found");
  const parsed = input.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = parsed.data;
  const jump = odometerJumpError(v.currentKm, data.km);
  if (jump) return fail(jump);
  const [rec, bumped] = await db.$transaction([
    db.fuelRecord.create({ data: { ...data, vehicleId } }),
    bumpOdometer(vehicleId, data.km),
  ]);
  revalidate(vehicleId);
  return ok({ id: rec.id, odometerUpdatedTo: bumped.count ? data.km : null });
}

export async function updateFuelRecord(id: string, raw: unknown): Promise<ActionResult<Saved>> {
  const user = await requireUser();
  const rec = await db.fuelRecord.findUnique({ where: { id }, include: { vehicle: true } });
  if (!rec || rec.vehicle.userId !== user.id) return fail("not_found");
  const parsed = input.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = parsed.data;
  const jump = odometerJumpError(rec.vehicle.currentKm, data.km);
  if (jump) return fail(jump);
  const [, bumped] = await db.$transaction([
    db.fuelRecord.update({ where: { id }, data }),
    bumpOdometer(rec.vehicleId, data.km),
  ]);
  revalidate(rec.vehicleId);
  return ok({ odometerUpdatedTo: bumped.count ? data.km : null });
}

export async function deleteFuelRecord(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const rec = await db.fuelRecord.findUnique({ where: { id }, include: { vehicle: true } });
  if (!rec || rec.vehicle.userId !== user.id) return fail("not_found");
  await db.fuelRecord.delete({ where: { id } });
  revalidate(rec.vehicleId);
  return ok(undefined);
}
