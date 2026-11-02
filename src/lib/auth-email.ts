import type { EmailProviderSendVerificationRequestParams } from "next-auth/providers/email";

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ENTITIES[c]);

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
// Numbers and captions: same face with tabular figures, like the app.
const DATA = `font-family:${FONT};font-variant-numeric:tabular-nums`;

export function verificationEmail({ email, url, expires }: { email: string; url: string; expires: Date }) {
  const hours = Math.max(1, Math.round((expires.getTime() - Date.now()) / 36e5));
  const ttl = `${hours} ${hours === 1 ? "hora" : "horas"}`;
  const [e, u] = [esc(email), esc(url)];
  const subject = "Entrar no Revv";
  const text = `Entrar no Revv

Use o link abaixo para entrar com ${email}:
${url}

O link expira em ${ttl} e só pode ser usado uma vez.
Se você não pediu este acesso, ignore este e-mail.
`;
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#0a0a0b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0b" style="background:#0a0a0b;"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#141416" style="max-width:440px;background:#141416;border:1px solid #27272a;border-radius:16px;"><tr><td style="padding:36px 32px;font-family:${FONT};color:#ffffff;text-align:center;">
<div style="font-size:32px;font-weight:700;letter-spacing:-0.5px;">RE<span style="color:#ff6a00;">VV</span></div>
<div style="margin:6px 0 28px;${DATA};font-size:12px;color:#959596;">Sua garagem, sob controle</div>
<p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#ffffff;">Use o botão abaixo para entrar com <strong>${e}</strong>.</p>
<a href="${u}" style="display:inline-block;padding:14px 28px;background:#ff6a00;border-radius:10px;font-size:14px;font-weight:700;color:#0a0a0b;text-decoration:none;">Entrar no Revv</a>
<p style="margin:28px 0 6px;font-size:12px;color:#959596;">Ou copie e cole este link no navegador:</p>
<p style="margin:0 0 28px;${DATA};font-size:11px;line-height:1.5;word-break:break-all;"><a href="${u}" style="color:#ff6a00;text-decoration:none;">${u}</a></p>
<p style="margin:0;padding-top:20px;border-top:1px solid #27272a;font-size:12px;line-height:1.5;color:#959596;">O link expira em ${ttl} e só pode ser usado uma vez. Se você não pediu este acesso, ignore este e-mail.</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
  return { subject, html, text };
}

export async function sendVerificationRequest({ identifier, url, expires, provider }: EmailProviderSendVerificationRequestParams) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: provider.from, to: identifier, ...verificationEmail({ email: identifier, url, expires }) }),
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
}
