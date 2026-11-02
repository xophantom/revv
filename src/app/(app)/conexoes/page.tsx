import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { currentOrigin } from "@/lib/origin";
import { mcpResource } from "@/lib/oauth/config";
import { APP_TIME_ZONE } from "@/lib/dates";
import { Panel, SectionHeading } from "@/components/ui/panel";
import { CopyUrl } from "./CopyUrl";
import { DisconnectButton } from "./DisconnectButton";

export const metadata: Metadata = { title: "Conexões" };

const dateTime = new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIME_ZONE, dateStyle: "short", timeStyle: "short" });

export default async function ConnectionsPage() {
  const user = await requireUser();
  const [grants, origin] = await Promise.all([
    db.oAuthGrant.findMany({
      where: { userId: user.id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, lastUsedAt: true, client: { select: { id: true, kind: true, name: true } } },
    }),
    currentOrigin(),
  ]);
  const mcpUrl = mcpResource(origin);

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-3xl font-bold">Conexões</h1>
        <p className="mt-1 text-sm text-muted">Apps que você autorizou a acessar sua garagem, como o Claude.</p>
      </div>

      <section>
        <SectionHeading>Apps conectados</SectionHeading>
        {grants.length === 0 ? (
          <p className="text-sm text-muted">Nenhum app conectado ainda. Veja abaixo como conectar o Claude.</p>
        ) : (
          <ul className="grid gap-3">
            {grants.map((g) => {
              // CIMD: the host that published the client's metadata, the part of its identity we can trust.
              const publisher = g.client.kind === "CIMD" ? new URL(g.client.id).host : null;
              const name = g.client.name ?? publisher ?? "App sem nome";
              return (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="wrap-break-word font-semibold">{name}</span>
                      <span
                        title={publisher ? `Identidade publicada em ${publisher}` : "O app se registrou sozinho; o nome não é verificado"}
                        className="whitespace-nowrap rounded-md border border-border px-2 py-0.5 text-[11px] text-muted"
                      >
                        {publisher ? `via ${publisher}` : "registro dinâmico"}
                      </span>
                    </div>
                    <p className="tabular-nums mt-1 text-xs text-muted">
                      Conectado em {dateTime.format(g.createdAt)} ·{" "}
                      {g.lastUsedAt ? `último uso ${formatDistanceToNow(g.lastUsedAt, { addSuffix: true, locale: ptBR })}` : "ainda não usado"}
                    </p>
                  </div>
                  <DisconnectButton grantId={g.id} name={name} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <SectionHeading>Conectar ao Claude</SectionHeading>
        <Panel>
          <ol className="grid list-decimal gap-3 pl-5 text-sm marker:text-accent">
            <li>
              No claude.ai (ou no app de desktop), abra <strong>Personalizar › Conectores</strong> e escolha{" "}
              <strong>Adicionar conector personalizado</strong>.
            </li>
            <li>
              Dê um nome, como Revv, e cole esta URL:
              <div className="mt-2"><CopyUrl value={mcpUrl} /></div>
            </li>
            <li>Na autenticação, mantenha <strong>Sign in</strong> (OAuth) e deixe o <strong>Client ID</strong> em branco.</li>
            <li>Clique em <strong>Conectar</strong>: o Claude abre o Revv para você entrar e tocar em <strong>Permitir</strong>.</li>
          </ol>
          <p className="mt-4 text-xs text-muted">O conector adicionado no claude.ai também aparece no app do Claude no celular.</p>
          <p className="mt-4 text-xs text-muted">
            No Claude Code: <code className="break-all font-mono">claude mcp add --transport http revv {mcpUrl}</code> e depois{" "}
            <code className="font-mono">/mcp</code> para entrar.
          </p>
        </Panel>
      </section>
    </div>
  );
}
