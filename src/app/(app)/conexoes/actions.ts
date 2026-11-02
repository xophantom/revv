"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { revokeUserGrant } from "@/lib/oauth/grants";
import { ok, fail, type ActionResult } from "@/lib/result";

// Deletes the grant with all its tokens: the app loses access on its next request.
export async function disconnectGrant(grantId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (typeof grantId !== "string" || !grantId) return fail("Conexão inválida");
  const removed = await revokeUserGrant(user.id, grantId);
  revalidatePath("/conexoes");
  return removed ? ok(undefined) : fail("Essa conexão já tinha sido removida");
}
