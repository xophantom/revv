import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Calendar dates (service date, due date) are stored as UTC midnight — that's what
// z.coerce.date("YYYY-MM-DD") produces. Always read them back through UTC parts so the
// day never shifts with the server's or the browser's timezone.

// "Today" is resolved in the app's timezone, not the server's (Vercel runs in UTC).
export const APP_TIME_ZONE = "America/Sao_Paulo";

const DAY_MS = 86_400_000;

// "YYYY-MM-DD" for today in the app timezone — default value for <input type="date">.
export function todayInputValue(timeZone = APP_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Today's calendar date as UTC midnight, comparable with stored dates.
export function todayDateOnly(timeZone = APP_TIME_ZONE): Date {
  return new Date(todayInputValue(timeZone));
}

// Formats a stored calendar date (pt-BR) using its UTC parts; same output on server and client.
export function formatDateOnly(value: Date | string, pattern: string): string {
  const d = new Date(value);
  return format(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), pattern, { locale: ptBR });
}

const utcMidnight = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

// Whole calendar days from a to b (negative when b is before a).
export function daysBetween(a: Date, b: Date): number {
  return Math.round((utcMidnight(b) - utcMidnight(a)) / DAY_MS);
}

// Adds calendar months, clamping to the last day of the target month (31/01 + 1 → 28/02).
export function addMonthsUTC(d: Date, months: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), lastDay)));
}

// Whole calendar months from a to b, ignoring the day of month.
export function monthsBetweenUTC(a: Date, b: Date): number {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}
