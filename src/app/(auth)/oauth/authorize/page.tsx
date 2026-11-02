import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { auth } from "@/auth";
import { authorizePath, validateAuthorizeRequest } from "@/lib/oauth/authorize";
import { readAuthorizeParams, type AuthorizeParams } from "@/lib/oauth/params";
import { isLoopbackRedirect, redirectHost } from "@/lib/oauth/redirect";
import { REFRESH_TOKEN_TTL_S } from "@/lib/oauth/tokens";
import { currentOrigin } from "@/lib/origin";
import { ConsentButtons } from "./ConsentButtons";
import { switchAccount } from "./actions";

export const metadata: Metadata = { title: "Autorizar acesso", robots: { index: false, follow: false } };

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="glass w-full max-w-sm rounded-2xl p-6 sm:p-8">
        <div className="mb-2 text-center text-4xl font-bold tracking-tight">RE<span className="text-accent">VV</span></div>
        <p className="mb-8 text-center text-xs text-muted">Sua garagem, sob controle</p>
        {children}
      </div>
    </div>
  );
}

function HiddenParams({ params }: { params: AuthorizeParams }) {
  return Object.entries(params).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-[11px] uppercase tracking-wider text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const source = readAuthorizeParams(await searchParams);
  const origin = await currentOrigin();
  const outcome = await validateAuthorizeRequest(source, origin);
  if (outcome.status === "invalid") {
    return (
      <Card>
        <h1 className="mb-3 text-xl font-bold">Não foi possível autorizar</h1>
        <p role="alert" className="text-sm text-muted">{outcome.message} Volte ao app e tente conectar de novo.</p>
        {outcome.detail && <p className="mt-4 break-all font-mono text-[11px] text-muted">{outcome.detail}</p>}
      </Card>
    );
  }

  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(authorizePath(source.params))}`);

  const { client, request } = outcome;
  // CIMD: the host serving the metadata vouches for the client; the name inside is self-declared.
  const publisher = client.kind === "CIMD" ? new URL(client.id).host : null;
  const name = client.name ?? publisher ?? "Um app sem nome";
  const returnHost = redirectHost(request.redirectUri);
  const loopback = isLoopbackRedirect(request.redirectUri);

  return (
    <Card>
      <h1 className="text-center text-xl font-bold">Conectar {name}?</h1>
      <p className="mt-2 text-center text-sm text-muted">{name} quer acessar sua conta Revv.</p>

      <dl className="mt-6 grid gap-3 rounded-xl border border-border bg-surface/60 p-4 text-sm">
        <Row label="App">
          <span className="wrap-break-word font-semibold">{name}</span>
          <span className="block text-xs text-muted">
            {publisher ? <>identidade publicada em <strong className="text-fg">{publisher}</strong></> : "nome informado pelo próprio app, sem verificação"}
          </span>
        </Row>
        <Row label="Depois volta para">
          <strong className="break-all text-base">{returnHost}</strong>
        </Row>
        <Row label="Sua conta">
          <span className="break-all">{session.user.email}</span>
          <form action={switchAccount} className="inline">
            <HiddenParams params={source.params} />
            <button type="submit" className="ml-2 cursor-pointer text-xs text-accent transition hover:opacity-80">Trocar de conta</button>
          </form>
        </Row>
      </dl>

      {loopback && (
        <div role="alert" className="mt-4 flex gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
          <p>
            O acesso vai para um programa rodando neste computador (<span className="tabular-nums">{returnHost}</span>), não para um site.
            Só permita se você acabou de iniciar a conexão, por exemplo no Claude Code.
          </p>
        </div>
      )}

      <div className="mt-6 text-sm">
        <p className="mb-2 font-semibold">O app poderá</p>
        <ul className="grid list-disc gap-1.5 pl-4 text-muted marker:text-accent">
          <li>ver e alterar os dados da sua garagem: veículos, manutenções, upgrades, abastecimentos e alertas</li>
          <li>continuar conectado até você desconectar em Conexões (a conexão expira após {REFRESH_TOKEN_TTL_S / 86_400} dias sem uso)</li>
        </ul>
      </div>

      <form className="mt-8">
        <HiddenParams params={source.params} />
        <ConsentButtons />
      </form>
      <p className="mt-4 text-center text-xs text-muted">Só permita se foi você quem pediu esta conexão.</p>
    </Card>
  );
}
