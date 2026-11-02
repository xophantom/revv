import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, auth, magicLinkEnabled } from "@/auth";
import { SubmitButton } from "./SubmitButton";

const ERRORS: Record<string, string> = {
  Verification: "Esse link expirou ou já foi usado. Peça um novo abaixo.",
  Configuration: "Não conseguimos enviar o link agora. Tente de novo em instantes.",
  AccessDenied: "Acesso negado para este e-mail.",
  RateLimited: "Muitos links pedidos para este e-mail. Aguarde alguns minutos e tente de novo.",
};

async function signInWith(provider: "resend" | "credentials", fd: FormData) {
  try {
    await signIn(provider, { email: String(fd.get("email") ?? ""), redirectTo: "/garage" });
  } catch (e) {
    if (e instanceof AuthError) redirect(`/login?error=${e.type}`);
    throw e;
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  if ((await auth())?.user) redirect("/garage");
  const { error } = await searchParams;
  const key = String(error ?? "");
  const message = error ? (Object.hasOwn(ERRORS, key) ? ERRORS[key] : "Algo deu errado ao entrar. Tente de novo.") : null;
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="glass w-full max-w-sm rounded-2xl p-8 text-center">
        <div className="mb-2 text-4xl font-bold tracking-tight">RE<span className="text-accent">VV</span></div>
        <p className="mono mb-8 text-xs text-muted">{"// sua garagem, sob controle"}</p>
        {message && <p role="alert" className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">{message}</p>}
        <form action={async (fd: FormData) => { "use server"; await signInWith(magicLinkEnabled ? "resend" : "credentials", fd); }} className="grid gap-3">
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
            <p className="mono text-[10px] text-muted">{"// dev only · qualquer email cria/loga uma conta, sem verificação"}</p>
            <div className="flex gap-2">
              <input name="email" type="email" required placeholder="dev@email.com"
                className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent" />
              <SubmitButton pendingText="..." className="mono rounded-md border border-border px-3 text-xs text-muted hover:text-fg">entrar</SubmitButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
