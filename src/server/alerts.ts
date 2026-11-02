// Alerts operations for a given user. Shared by the server actions (session user) and the
// MCP tools (OAuth token user); never import from client code.
import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ok, fail, type ActionResult } from "@/lib/result";
import { todayDateOnly } from "@/lib/dates";
import { isRecurring, nextOccurrence } from "@/domain/recurrence";

const input = z.object({
  label: z.string().min(1, "Descrição obrigatória"),
  // null clears the field when editing
  dueKm: z.coerce.number().int().min(0).max(9_999_999, "Km grande demais").nullish(),
  dueDate: z.coerce.date().nullish(),
  repeatMonths: z.coerce.number().int("Repetição inválida").positive("Repetição deve ser maior que zero").max(120, "Repetição de até 120 meses").nullish(),
  repeatKm: z.coerce.number().int("Repetição inválida").positive("Repetição deve ser maior que zero").max(1_000_000, "Repetição grande demais").nullish(),
});

function parseAlert(raw: unknown) {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  if (d.dueKm == null && d.dueDate == null) return fail("informe km ou data");
  // The repeat moves its own target forward, so that target has to exist.
  if (d.repeatMonths && d.dueDate == null) return fail("informe a data para repetir por meses");
  if (d.repeatKm && d.dueKm == null) return fail("informe o km para repetir por km");
  return ok({
    label: d.label,
    dueKm: d.dueKm ?? null,
    dueDate: d.dueDate ?? null,
    repeatMonths: d.repeatMonths ?? null,
    repeatKm: d.repeatKm ?? null,
    // The day a monthly repeat aims for, before any month-end clamping moves the stored date.
    dueDay: d.repeatMonths && d.dueDate ? d.dueDate.getUTCDate() : null,
  });
}

export async function createCustomAlert(userId: string, vehicleId: string, raw: unknown): Promise<ActionResult<{ id: string }>> {
  const v = await db.vehicle.findUnique({ where: { id: vehicleId } });
  if (!v || v.userId !== userId) return fail("not_found");
  const parsed = parseAlert(raw);
  if (!parsed.ok) return parsed;
  const rec = await db.customAlert.create({ data: { vehicleId, ...parsed.data } });
  revalidatePath(`/garage/${vehicleId}`);
  return ok({ id: rec.id });
}

export async function updateCustomAlert(userId: string, id: string, raw: unknown): Promise<ActionResult> {
  const alert = await db.customAlert.findUnique({ where: { id }, include: { vehicle: true } });
  if (!alert || alert.vehicle.userId !== userId) return fail("not_found");
  const parsed = parseAlert(raw);
  if (!parsed.ok) return parsed;
  // Same date and period: keep the day it aims for, which a month-end clamp may have moved off the stored date.
  const sameSchedule = parsed.data.dueDate?.getTime() === alert.dueDate?.getTime() && parsed.data.repeatMonths === alert.repeatMonths;
  await db.customAlert.update({ where: { id }, data: { ...parsed.data, dueDay: sameSchedule ? alert.dueDay : parsed.data.dueDay } });
  revalidatePath(`/garage/${alert.vehicleId}`);
  return ok(undefined);
}

// `next` is set when a recurring alert rolled forward instead of being marked done.
export type ToggleResult = { next: { dueDate: string | null; dueKm: number | null } | null };

// What the screen showed when the user clicked; a stale tab (another device already completed it)
// must not complete it again.
export type ToggleSeen = { done: boolean; dueDate: string | null; dueKm: number | null };

export async function toggleCustomAlertDone(userId: string, id: string, seen: ToggleSeen): Promise<ActionResult<ToggleResult>> {
  const alert = await db.customAlert.findUnique({ where: { id }, include: { vehicle: true } });
  if (!alert || alert.vehicle.userId !== userId) return fail("not_found");
  if (alert.done !== seen.done || (alert.dueDate?.toISOString() ?? null) !== seen.dueDate || alert.dueKm !== seen.dueKm) {
    return fail("O alerta mudou; recarregue a página");
  }

  // A done alert always goes back to pending, recurring or not.
  if (alert.done || !isRecurring(alert)) {
    await db.customAlert.update({ where: { id }, data: { done: !alert.done } });
    revalidatePath(`/garage/${alert.vehicleId}`);
    return ok({ next: null });
  }

  const next = nextOccurrence({ ...alert, today: todayDateOnly(), currentKm: alert.vehicle.currentKm })!;
  // Matches the values just read, so a double submit can't roll the alert twice.
  const { count } = await db.customAlert.updateMany({
    where: { id, done: false, dueDate: alert.dueDate, dueKm: alert.dueKm },
    data: next,
  });
  if (count === 0) return fail("O alerta mudou; recarregue a página");
  revalidatePath(`/garage/${alert.vehicleId}`);
  return ok({ next: { dueDate: next.dueDate?.toISOString() ?? null, dueKm: next.dueKm } });
}

export async function deleteCustomAlert(userId: string, id: string): Promise<ActionResult> {
  const alert = await db.customAlert.findUnique({ where: { id }, include: { vehicle: true } });
  if (!alert || alert.vehicle.userId !== userId) return fail("not_found");
  await db.customAlert.delete({ where: { id } });
  revalidatePath(`/garage/${alert.vehicleId}`);
  return ok(undefined);
}
