// Spec operations for a given user. Shared by the server actions (session user) and the
// MCP tools (OAuth token user); never import from client code.
import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ok, fail, type ActionResult } from "@/lib/result";
import { vehicleSpecSchema } from "@/domain/spec-schema";

export async function upsertSpec(userId: string, vehicleId: string, raw: unknown): Promise<ActionResult> {
  const v = await db.vehicle.findUnique({ where: { id: vehicleId } });
  if (!v || v.userId !== userId) return fail("not_found");
  const parsed = vehicleSpecSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message);
  }
  await db.vehicleSpec.upsert({
    where: { vehicleId },
    create: { vehicleId, data: parsed.data },
    update: { data: parsed.data },
  });
  revalidatePath(`/garage/${vehicleId}`);
  return ok(undefined);
}
