import type { Alert } from "@/domain/alerts";
import { APP_TIME_ZONE, daysBetween } from "@/lib/dates";

// An unchanged list is repeated at most this often.
export const DIGEST_REPEAT_DAYS = 7;

export type DigestItem = Alert & { vehicleId: string; vehicleName: string };

export type DigestDecision = { send: false } | { send: true; items: DigestItem[]; key: string };

// Only what needs action: overdue first, then soon; the stable sort keeps each vehicle's urgency order.
export function digestItems(alerts: DigestItem[]): DigestItem[] {
  return alerts
    .filter((a) => a.status === "overdue" || a.status === "soon")
    .sort((a, b) => Number(a.status === "soon") - Number(b.status === "soon"));
}

// Which alerts were listed and in which state, one "vehicleId/alertId/status" per line, regardless
// of order or wording. Kept readable (not hashed) so the next run can tell what is new.
export function digestKey(items: Pick<DigestItem, "vehicleId" | "id" | "status">[]): string {
  return items.map((a) => `${a.vehicleId}/${a.id}/${a.status}`).sort().join("\n");
}

// Calendar date (UTC midnight) of an instant in the app timezone, comparable with `today`.
function calendarDate(instant: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return new Date(`${get("year")}-${get("month")}-${get("day")}`);
}

// Sends when something new needs attention (a new item, or one that went from soon to overdue), or
// when the list is a week old. Resolving an item alone sends nothing. Days are calendar days, so a
// run a few seconds earlier than last week's still counts as 7.
export function planDigest({ alerts, lastKey, lastAt, today, timeZone = APP_TIME_ZONE }: {
  alerts: DigestItem[];
  lastKey: string | null;
  lastAt: Date | null;
  today: Date; // calendar date, UTC midnight
  timeZone?: string;
}): DigestDecision {
  const items = digestItems(alerts);
  if (!items.length) return { send: false };
  const key = digestKey(items);
  const sent = new Set(lastKey?.split("\n"));
  const fresh = key.split("\n").some((entry) => !sent.has(entry));
  const stale = !lastAt || daysBetween(calendarDate(lastAt, timeZone), today) >= DIGEST_REPEAT_DAYS;
  return fresh || stale ? { send: true, items, key } : { send: false };
}
