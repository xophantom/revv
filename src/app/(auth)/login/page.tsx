import type { Metadata } from "next";
import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signIn, auth, magicLinkEnabled } from "@/auth";
import { AUTHORIZE_PATH, RETURN_COOKIE } from "@/lib/oauth/config";
import { safeCallbackPath } from "@/lib/oauth/redirect";
import { SubmitButton } from "./SubmitButton";

export const metadata: Metadata = { title: "Entrar" };

const ERRORS: Record<string, string> = {
  Verification: "Esse link expirou ou já foi usado. Peça um novo abaixo.",
  Configuration: "Não conseguimos enviar o link agora. Tente de novo em instantes.",
  AccessDenied: "Acesso negado para este e-mail.",
  RateLimited: "Muitos links pedidos para este e-mail. Aguarde alguns minutos e tente de novo.",
};

async function signInWith(provider: "resend" | "credentials", fd: FormData) {
  // Re-checked here: the hidden field comes back from the browser.
  const callback = safeCallbackPath(fd.get("callbackUrl"));
  // A magic link can be opened anywhere: anyone could otherwise send the owner a genuine sign-in e-mail
  // that ends on a consent screen of their choosing. The return path stays in this browser instead.
  let redirectTo = callback ?? "/garage";
  if (provider === "resend" && callback) {
    (await cookies()).set(RETURN_COOKIE, callback, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 15 * 60, path: "/" });
    redirectTo = "/login/continue";
  }
  try {
    await signIn(provider, { email: String(fd.get("email") ?? ""), redirectTo });
  } catch (e) {
    if (e instanceof AuthError) redirect(`/login?error=${e.type}${callback ? `&callbackUrl=${encodeURIComponent(callback)}` : ""}`);
    throw e;
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[]; callbackUrl?: string | string[] }> }) {
  const { error, callbackUrl } = await searchParams;
  // Same-site paths only (e.g. the OAuth consent page sending an anonymous user here and back).
  const callback = safeCallbackPath(callbackUrl);
  if ((await auth())?.user) redirect(callback ?? "/garage");
  const key = String(error ?? "");
  const message = error ? (Object.hasOwn(ERRORS, key) ? ERRORS[key] : "Algo deu errado ao entrar. Tente de novo.") : null;
  const callbackField = callback && <input type="hidden" name="callbackUrl" value={callback} />;
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="glass w-full max-w-sm rounded-2xl p-8 text-center">
        <div className="mb-2 text-4xl font-bold tracking-tight">RE<span className="text-accent">VV</span></div>
        <p className="mb-8 text-xs text-muted">Sua garagem, sob controle</p>
        {callback?.startsWith(`${AUTHORIZE_PATH}?`) && <p className="mb-4 text-sm text-muted">Entre para autorizar o app que pediu acesso à sua garagem.</p>}
        {message && <p role="alert" className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">{message}</p>}
        <form action={async (fd: FormData) => { "use server"; await signInWith(magicLinkEnabled ? "resend" : "credentials", fd); }} className="grid gap-3">
          {callbackField}
          <input name="email" type="email" required autoComplete="email" placeholder="seu@email.com"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent" />
          <SubmitButton pendingText={magicLinkEnabled ? "Enviando link..." : "Entrando..."} className="w-full rounded-lg bg-accent py-3 text-sm font-bold text-bg">
            {magicLinkEnabled ? "Enviar link de acesso" : "Entrar"}
          </SubmitButton>
        </form>
        {magicLinkEnabled && <p className="mt-4 text-xs text-muted">Vamos enviar um link de acesso para o seu e-mail. Sem senha.</p>}
        {magicLinkEnabled && process.env.NODE_ENV !== "production" && (
          <form action={async (fd: FormData) => { "use server"; await signInWith("credentials", fd); }}
            className="mt-8 grid gap-2 rounded-lg border border-dashed border-border p-3 text-left">
            {callbackField}
            <p className="text-[11px] text-muted">Só em desenvolvimento: qualquer e-mail cria ou entra numa conta, sem verificação</p>
            <div className="flex gap-2">
              <input name="email" type="email" required placeholder="dev@email.com"
                className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent" />
              <SubmitButton pendingText="..." className="tabular-nums rounded-md border border-border px-3 text-xs text-muted hover:text-fg">entrar</SubmitButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
