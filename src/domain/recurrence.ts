import { monthsBetweenUTC } from "@/lib/dates";

export type Recurrence = { repeatMonths: number | null; repeatKm: number | null };

export type OccurrenceInput = Recurrence & {
  dueDate: Date | null;
  dueDay?: number | null; // day of month the repeat aims for; defaults to dueDate's day
  dueKm: number | null;
  today: Date; // calendar date, UTC midnight
  currentKm: number;
};

export type Occurrence = { dueDate: Date | null; dueKm: number | null };

export const isRecurring = (r: Recurrence) => Boolean(r.repeatMonths || r.repeatKm);

// Due values after completing the current occurrence, or null when the alert doesn't repeat.
// A dimension without its own repeat belonged to the occurrence just completed, so it's cleared.
export function nextOccurrence(input: OccurrenceInput): Occurrence | null {
  if (!isRecurring(input)) return null;
  return { dueDate: nextDate(input), dueKm: nextKm(input) };
}

// `months` after `from`, on `day` or the month's last day when it's shorter (31 → 28/02).
function monthsAhead(from: Date, months: number, day: number): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, lastDay)));
}

// Whole periods ahead until strictly after today, so IPVA keeps its calendar day. The stored date
// may already be clamped (28/02), so the day comes from `dueDay`: 31/01 → 28/02 → 31/03.
function nextDate({ dueDate, dueDay, repeatMonths, today }: OccurrenceInput): Date | null {
  if (!repeatMonths || !dueDate) return null;
  const day = dueDay ?? dueDate.getUTCDate();
  // Skip straight to the periods near today; this never overshoots the first one after it.
  let k = Math.max(1, Math.floor(monthsBetweenUTC(dueDate, today) / repeatMonths));
  let next = monthsAhead(dueDate, k * repeatMonths, day);
  while (next.getTime() <= today.getTime()) next = monthsAhead(dueDate, ++k * repeatMonths, day);
  return next;
}

// Distance-based items (wipers, a belt check) restart when done, early or late: from the odometer.
function nextKm({ repeatKm, currentKm }: OccurrenceInput): number | null {
  return repeatKm ? currentKm + repeatKm : null;
}

// Short tag for a recurring alert: "anual", "mensal", "6 meses", "10.000 km".
export function recurrenceLabel({ repeatMonths, repeatKm }: Recurrence): string | null {
  if (repeatMonths) return repeatMonths === 12 ? "anual" : repeatMonths === 1 ? "mensal" : `${repeatMonths} meses`;
  if (repeatKm) return `${repeatKm.toLocaleString("pt-BR")} km`;
  return null;
}
