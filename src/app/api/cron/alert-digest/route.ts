import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { vehicleSpecSchema, emptySpec } from "@/domain/spec-schema";
import { computeAlerts, type AlertInput } from "@/domain/alerts";
import { planDigest, type DigestItem } from "@/lib/alert-digest";
import { alertDigestEmail, alertMailer, appBaseUrl, sendAlertEmail } from "@/lib/alert-email";
import { todayDateOnly, todayInputValue } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Bounds one run: at most this many users, and no new user once the time budget is spent.
const MAX_USERS = 500;
const TIME_BUDGET_MS = 45_000;
const SEND_SPACING_MS = 550;

function authorized(header: string | null, secret: string): boolean {
  const got = Buffer.from(header ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

// Same inputs as the dashboard, over all of the user's vehicles.
async function userAlerts(userId: string, today: Date): Promise<DigestItem[]> {
  const vehicles = await db.vehicle.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      currentKm: true,
      spec: { select: { data: true } },
      maintenances: { select: { category: true, date: true, km: true, specRuleIds: true } },
      customAlerts: { where: { done: false }, select: { id: true, label: true, dueKm: true, dueDate: true, done: true, repeatMonths: true, repeatKm: true } },
    },
  });
  return vehicles.flatMap((v) => {
    const input: AlertInput = {
      currentKm: v.currentKm,
      today,
      spec: v.spec ? vehicleSpecSchema.parse(v.spec.data) : emptySpec(),
      maintenances: v.maintenances,
      customAlerts: v.customAlerts,
    };
    return computeAlerts(input).map((a) => ({ ...a, vehicleId: v.id, vehicleName: v.name }));
  });
}

// Daily alert e-mail, called by Vercel Cron (vercel.json) with `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ status: "disabled", reason: "CRON_SECRET não configurado" }, { status: 503 });
  if (!authorized(request.headers.get("authorization"), secret)) return Response.json({ status: "unauthorized" }, { status: 401 });
  const mailer = alertMailer();
  if (!mailer) return Response.json({ status: "disabled", reason: "RESEND_API_KEY (ou AUTH_RESEND_KEY) não configurada" }, { status: 503 });
  const baseUrl = appBaseUrl(process.env, new URL(request.url).origin)!;

  const started = Date.now();
  const today = todayDateOnly();
  const day = todayInputValue();
  // Least recently e-mailed first, so a run cut short doesn't starve the same users every day.
  // Only confirmed addresses: the e-mail-only login lets anyone open an account for any e-mail, and
  // the digest would carry their text to that inbox from our domain. Unconfirmed owners opt in by
  // listing their address in ALERT_EMAIL_TO.
  const allowed = (process.env.ALERT_EMAIL_TO ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  const users = await db.user.findMany({
    where: {
      email: { not: null },
      vehicles: { some: {} },
      OR: [{ emailVerified: { not: null } }, { email: { in: allowed, mode: "insensitive" } }],
    },
    select: { id: true, email: true, alertDigestAt: true, alertDigestKey: true },
    orderBy: [{ alertDigestAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
    take: MAX_USERS,
  });

  const summary = { users: users.length, sent: 0, skipped: 0, failed: 0, deferred: 0 };
  let lastSend = 0;
  for (const [i, user] of users.entries()) {
    if (Date.now() - started > TIME_BUDGET_MS) { summary.deferred = users.length - i; break; }
    if (!user.email) continue;
    try {
      const alerts = await userAlerts(user.id, today);
      const plan = planDigest({ alerts, lastKey: user.alertDigestKey, lastAt: user.alertDigestAt, today });
      if (!plan.send) { summary.skipped++; continue; }
      // Resend's default limit is 2 requests/s.
      const wait = lastSend + SEND_SPACING_MS - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastSend = Date.now();
      await sendAlertEmail(mailer, {
        to: user.email,
        email: alertDigestEmail({ items: plan.items, baseUrl }),
        idempotencyKey: `alert-digest/${user.id}/${day}/${createHash("sha256").update(plan.key).digest("hex").slice(0, 16)}`,
      });
      // Only after Resend accepted it: a failed send is retried on the next run.
      await db.user.update({ where: { id: user.id }, data: { alertDigestAt: new Date(), alertDigestKey: plan.key } });
      summary.sent++;
    } catch (err) {
      summary.failed++;
      console.error(`[alert-digest] user ${user.id}:`, err);
    }
  }
  if (summary.deferred) console.warn(`[alert-digest] time budget spent, ${summary.deferred} users left for the next run`);
  return Response.json({ status: "ok", ...summary, ms: Date.now() - started });
}
