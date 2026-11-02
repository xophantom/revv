import type { AlertStatus } from "@/domain/alerts";
import { alertDetail } from "@/lib/alert-text";
import type { DigestItem } from "@/lib/alert-digest";

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ENTITIES[c]);

const FONT = "'Space Grotesk',Helvetica,Arial,sans-serif";
const MONO = "'JetBrains Mono',Menlo,Consolas,monospace";

type Env = Record<string, string | undefined>;

export type Mailer = { apiKey: string; from: string };

// Alert e-mails reuse the login's Resend setup unless they get their own.
export function alertMailer(env: Env = process.env): Mailer | null {
  const apiKey = env.RESEND_API_KEY || env.AUTH_RESEND_KEY;
  if (!apiKey) return null;
  return { apiKey, from: env.ALERT_EMAIL_FROM || env.AUTH_EMAIL_FROM || "Revv <onboarding@resend.dev>" };
}

// Where the e-mail links point. AUTH_URL may carry Auth.js's base path, so only its origin is used.
export function appBaseUrl(env: Env = process.env, fallbackOrigin?: string): string | null {
  const trim = (u: string) => u.replace(/\/+$/, "");
  if (env.APP_URL) return trim(env.APP_URL);
  if (env.AUTH_URL) {
    try { return new URL(env.AUTH_URL).origin; } catch { /* malformed: try the next one */ }
  }
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${trim(env.VERCEL_PROJECT_PRODUCTION_URL)}`;
  return fallbackOrigin ? trim(fallbackOrigin) : null;
}

// Same targets as the dashboard: spec items open the service form, custom ones the alert list.
export function alertLink(base: string, a: Pick<DigestItem, "vehicleId" | "id" | "source">): string {
  const vehicle = `${base}/garage/${encodeURIComponent(a.vehicleId)}`;
  return a.source === "spec" ? `${vehicle}?registrar=${encodeURIComponent(a.id)}` : `${vehicle}#alertas`;
}

const STATUS_TEXT: Partial<Record<AlertStatus, string>> = { overdue: "atrasado", soon: "em breve" };

function counts(items: DigestItem[]): string[] {
  const overdue = items.filter((a) => a.status === "overdue").length;
  const soon = items.filter((a) => a.status === "soon").length;
  return [
    overdue ? `${overdue} ${overdue === 1 ? "atrasado" : "atrasados"}` : "",
    soon ? `${soon} em breve` : "",
  ].filter(Boolean);
}

// "Revv: 2 atrasados, 1 em breve"
export function digestSubject(items: DigestItem[]): string {
  return `Revv: ${counts(items).join(", ")}`;
}

// Vehicles in the order their first item appears, so the one with overdue items leads.
function byVehicle(items: DigestItem[]): { name: string; items: DigestItem[] }[] {
  const groups = new Map<string, { name: string; items: DigestItem[] }>();
  for (const a of items) {
    const g = groups.get(a.vehicleId) ?? { name: a.vehicleName, items: [] };
    g.items.push(a);
    groups.set(a.vehicleId, g);
  }
  return [...groups.values()];
}

const PILL: Partial<Record<AlertStatus, string>> = {
  overdue: "background:#ff6a00;border:1px solid #ff6a00;color:#0a0a0b;",
  soon: "background:#2b1d14;border:1px solid #ff6a00;color:#ff6a00;",
};

export function alertDigestEmail({ items, baseUrl }: { items: DigestItem[]; baseUrl: string }) {
  const subject = digestSubject(items);
  const summary = counts(items).join(" · ");
  const appLink = `${baseUrl}/dashboard`;
  const groups = byVehicle(items);
  const footer = `Você recebe este resumo quando há alertas atrasados ou próximos. Se nada mudar, ele se repete a cada 7 dias.`;

  const text = [
    subject,
    "",
    ...groups.flatMap((g) => [
      g.name,
      ...g.items.flatMap((a) => {
        const detail = alertDetail(a);
        return [`- [${STATUS_TEXT[a.status]}] ${a.label}${detail ? `: ${detail}` : ""}`, `  ${alertLink(baseUrl, a)}`];
      }),
      "",
    ]),
    `Abrir o Revv: ${appLink}`,
    "",
    footer,
    "",
  ].join("\n");

  const rows = groups.map((g) => {
    const list = g.items.map((a, i) => `<tr><td style="padding:12px 14px;${i ? "border-top:1px solid #27272a;" : ""}">
<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-family:${MONO};font-size:11px;${PILL[a.status]}">${STATUS_TEXT[a.status]}</span>
<a href="${esc(alertLink(baseUrl, a))}" style="margin-left:8px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${esc(a.label)}</a>
<div style="margin-top:6px;font-family:${MONO};font-size:12px;color:#959596;">${esc(alertDetail(a))}</div>
</td></tr>`).join("\n");
    return `<div style="margin:0 0 8px;font-family:${MONO};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#959596;">${esc(g.name)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;border:1px solid #27272a;border-radius:10px;text-align:left;">
${list}
</table>`;
  }).join("\n");

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#0a0a0b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0b" style="background:#0a0a0b;"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#141416" style="max-width:520px;background:#141416;border:1px solid #27272a;border-radius:16px;"><tr><td style="padding:36px 32px;font-family:${FONT};color:#ffffff;">
<div style="text-align:center;font-size:32px;font-weight:700;letter-spacing:-0.5px;">RE<span style="color:#ff6a00;">VV</span></div>
<div style="margin:6px 0 28px;text-align:center;font-family:${MONO};font-size:12px;color:#959596;">// alertas da garagem</div>
<p style="margin:0 0 24px;text-align:center;font-size:15px;line-height:1.5;color:#ffffff;">${esc(summary)}</p>
${rows}
<div style="margin:8px 0 0;text-align:center;"><a href="${esc(appLink)}" style="display:inline-block;padding:14px 28px;background:#ff6a00;border-radius:10px;font-size:14px;font-weight:700;color:#0a0a0b;text-decoration:none;">Abrir o Revv</a></div>
<p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #27272a;text-align:center;font-size:12px;line-height:1.5;color:#959596;">${esc(footer)}</p>
</td></tr></table>
</td></tr></table>
</body></html>`;

  return { subject, html, text };
}

export async function sendAlertEmail(mailer: Mailer, { to, email, idempotencyKey }: {
  to: string;
  email: { subject: string; html: string; text: string };
  idempotencyKey: string; // Resend drops a repeat within 24h, e.g. a cron delivered twice
}) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${mailer.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ from: mailer.from, to, ...email }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
}
