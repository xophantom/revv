"use server";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { authorizePath, validateAuthorizeRequest } from "@/lib/oauth/authorize";
import { createAuthorizationCode } from "@/lib/oauth/grants";
import { paramsFromForm } from "@/lib/oauth/params";
import { buildRedirect } from "@/lib/oauth/redirect";
import { currentOrigin } from "@/lib/origin";

// The form only carries the original request; everything is validated again here.
async function decide(fd: FormData, allow: boolean): Promise<never> {
  const source = paramsFromForm(fd);
  const origin = await currentOrigin();
  const outcome = await validateAuthorizeRequest(source, origin);
  // Something changed since the page rendered (e.g. the client's metadata): the page explains it.
  if (outcome.status === "invalid") redirect(authorizePath(source.params));
  const { client, request } = outcome;
  if (!allow) redirect(buildRedirect(request.redirectUri, { error: "access_denied", state: request.state, iss: origin }));

  const userId = (await auth())?.user?.id;
  if (!userId) redirect(`/login?callbackUrl=${encodeURIComponent(authorizePath(source.params))}`);
  const code = await createAuthorizationCode({
    clientId: client.id,
    userId,
    redirectUri: request.redirectUri,
    codeChallenge: request.codeChallenge,
    scopes: request.scopes,
    resource: request.resource,
  });
  // RFC 9207: iss lets the client check which server answered.
  redirect(buildRedirect(request.redirectUri, { code, state: request.state, iss: origin }));
}

export async function allowAccess(fd: FormData) {
  await decide(fd, true);
}

export async function denyAccess(fd: FormData) {
  await decide(fd, false);
}

export async function switchAccount(fd: FormData) {
  const { params } = paramsFromForm(fd);
  await signOut({ redirectTo: `/login?callbackUrl=${encodeURIComponent(authorizePath(params))}` });
}
