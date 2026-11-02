import { AUTHORIZE_PATH } from "./config";
import { resolveClient, type KnownClient } from "./clients";
import { checkAuthorizeParams, type AuthorizeParamName, type AuthorizeParams, type AuthorizeRequest } from "./params";
import { matchRedirectUri } from "./redirect";

export type AuthorizeOutcome =
  // Shown on our page, never redirected: with open registration a registered redirect_uri isn't a
  // trusted one (RFC 9700 §4.11.2), so redirecting errors would make this an open redirector.
  | { status: "invalid"; message: string; detail?: string }
  | { status: "ok"; client: KnownClient; request: AuthorizeRequest };

// Runs for the consent page and again in its Permitir/Negar actions. Order: client, redirect_uri, the rest.
export async function validateAuthorizeRequest(
  { params, repeated }: { params: AuthorizeParams; repeated: AuthorizeParamName[] },
  origin: string,
): Promise<AuthorizeOutcome> {
  const clientId = params.client_id;
  if (!clientId || repeated.includes("client_id")) {
    return { status: "invalid", message: "O pedido não diz qual app quer acessar sua conta.", detail: "client_id missing or repeated" };
  }
  const found = await resolveClient(clientId);
  if (!found.ok) return { status: "invalid", message: "Não reconhecemos o app que pediu acesso.", detail: found.reason };
  const redirectUri = params.redirect_uri;
  if (!redirectUri || repeated.includes("redirect_uri")) {
    return { status: "invalid", message: "O pedido não diz para onde voltar depois da autorização.", detail: "redirect_uri missing or repeated" };
  }
  if (!matchRedirectUri(found.client.redirectUris, redirectUri)) {
    return { status: "invalid", message: "O endereço de retorno não está registrado para este app.", detail: `redirect_uri not registered: ${redirectUri}` };
  }
  const checked = checkAuthorizeParams({ ...params, client_id: clientId, redirect_uri: redirectUri }, origin, repeated);
  if (!checked.ok) {
    return { status: "invalid", message: "O pedido de autorização veio incompleto ou inválido.", detail: `${checked.error}: ${checked.description}` };
  }
  return { status: "ok", client: found.client, request: checked.request };
}

// This authorize URL, for /login?callbackUrl= to come back to.
export const authorizePath = (params: AuthorizeParams) =>
  `${AUTHORIZE_PATH}?${new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => typeof e[1] === "string"))}`;
