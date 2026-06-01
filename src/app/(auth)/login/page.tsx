import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  if ((await auth())?.user) redirect("/garage");
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="glass w-full max-w-sm rounded-2xl p-8 text-center">
        <div className="mb-2 text-4xl font-bold tracking-tight">RE<span className="text-accent">VV</span></div>
        <p className="mono mb-8 text-xs text-muted">// sua garagem, sob controle</p>
        <form action={async (fd: FormData) => { "use server"; await signIn("credentials", { email: String(fd.get("email") ?? ""), redirectTo: "/garage" }); }} className="grid gap-3">
          <input name="email" type="email" required placeholder="seu@email.com"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent" />
          <button type="submit" className="w-full rounded-lg bg-accent py-3 text-sm font-bold text-bg">Entrar</button>
        </form>
        <p className="mono mt-4 text-[10px] text-muted">dev: qualquer email cria/loga uma conta</p>
      </div>
    </div>
  );
}
