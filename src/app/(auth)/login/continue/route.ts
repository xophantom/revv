import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RETURN_COOKIE } from "@/lib/oauth/config";
import { safeCallbackPath } from "@/lib/oauth/redirect";

export const dynamic = "force-dynamic";

// Where the magic link lands. The page to return to (e.g. a consent screen) was kept in a cookie by the
// browser that asked for the link, not in the e-mail: opened anywhere else, it just goes to the garage.
export async function GET() {
  const jar = await cookies();
  const back = safeCallbackPath(jar.get(RETURN_COOKIE)?.value);
  jar.delete(RETURN_COOKIE);
  redirect(back ?? "/garage");
}
