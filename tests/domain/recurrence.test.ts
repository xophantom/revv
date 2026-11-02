import { describe, it, expect } from "vitest";
import { isRecurring, nextOccurrence, recurrenceLabel, type OccurrenceInput } from "@/domain/recurrence";

const d = (s: string) => new Date(s);
const iso = (x: Date | null) => x?.toISOString().slice(0, 10) ?? null;

const base: OccurrenceInput = {
  dueDate: null, dueKm: null, repeatMonths: null, repeatKm: null,
  today: d("2026-11-02"), currentKm: 90000,
};

describe("nextOccurrence by months", () => {
  it("returns null for a non-recurring alert", () => {
    expect(nextOccurrence({ ...base, dueDate: d("2026-12-01") })).toBeNull();
    expect(isRecurring(base)).toBe(false);
  });

  it("moves one period ahead when completed before the due date, keeping the calendar day", () => {
    const n = nextOccurrence({ ...base, dueDate: d("2027-01-15"), repeatMonths: 12 })!;
    expect(iso(n.dueDate)).toBe("2028-01-15");
  });

  it("moves one period ahead when completed shortly after the due date", () => {
    const n = nextOccurrence({ ...base, dueDate: d("2026-10-20"), repeatMonths: 12 })!;
    expect(iso(n.dueDate)).toBe("2027-10-20");
  });

  it("skips every missed period until the date is after today", () => {
    const n = nextOccurrence({ ...base, dueDate: d("2023-03-10"), repeatMonths: 12 })!;
    expect(iso(n.dueDate)).toBe("2027-03-10");
    const m = nextOccurrence({ ...base, dueDate: d("2025-01-05"), repeatMonths: 1 })!;
    expect(iso(m.dueDate)).toBe("2026-11-05");
    const q = nextOccurrence({ ...base, dueDate: d("2024-12-02"), repeatMonths: 3 })!;
    expect(iso(q.dueDate)).toBe("2026-12-02");
  });

  it("is strictly after today: a step landing on today moves one more period", () => {
    const n = nextOccurrence({ ...base, dueDate: d("2026-10-02"), repeatMonths: 1 })!;
    expect(iso(n.dueDate)).toBe("2026-12-02");
  });

  it("clamps to month end without drifting the anchor day", () => {
    const jan31 = { ...base, dueDate: d("2026-01-31"), repeatMonths: 1 };
    expect(iso(nextOccurrence({ ...jan31, today: d("2026-01-31") })!.dueDate)).toBe("2026-02-28");
    // stepping from the anchor: March keeps the 31st instead of inheriting February's 28th
    expect(iso(nextOccurrence({ ...jan31, today: d("2026-03-01") })!.dueDate)).toBe("2026-03-31");
    expect(iso(nextOccurrence({ ...jan31, today: d("2026-04-15") })!.dueDate)).toBe("2026-04-30");
  });

  it("keeps aiming for the 31st after a clamped month is stored", () => {
    // completed in February: 28/02 was stored, dueDay still says 31
    const n = nextOccurrence({ ...base, today: d("2026-02-20"), dueDate: d("2026-02-28"), dueDay: 31, repeatMonths: 1 })!;
    expect(iso(n.dueDate)).toBe("2026-03-31");
    const leap = nextOccurrence({ ...base, today: d("2025-03-01"), dueDate: d("2025-02-28"), dueDay: 29, repeatMonths: 12 })!;
    expect(iso(leap.dueDate)).toBe("2026-02-28");
    const back = nextOccurrence({ ...base, today: d("2027-03-01"), dueDate: d("2027-02-28"), dueDay: 29, repeatMonths: 12 })!;
    expect(iso(back.dueDate)).toBe("2028-02-29");
  });

  it("clamps Feb 29 to Feb 28 in a non-leap year", () => {
    const n = nextOccurrence({ ...base, today: d("2024-03-01"), dueDate: d("2024-02-29"), repeatMonths: 12 })!;
    expect(iso(n.dueDate)).toBe("2025-02-28");
  });

  it("clears a km target that doesn't repeat", () => {
    const n = nextOccurrence({ ...base, dueDate: d("2026-12-01"), dueKm: 95000, repeatMonths: 12 })!;
    expect(n.dueKm).toBeNull();
    expect(iso(n.dueDate)).toBe("2027-12-01");
  });
});

describe("nextOccurrence by km", () => {
  it("restarts from the odometer when completed late", () => {
    const n = nextOccurrence({ ...base, dueKm: 88000, repeatKm: 10000 })!;
    expect(n.dueKm).toBe(100000);
  });

  it("restarts from the odometer when completed early too (done at 90k, due at 92k → 100k)", () => {
    const n = nextOccurrence({ ...base, dueKm: 92000, repeatKm: 10000 })!;
    expect(n.dueKm).toBe(100000);
  });

  it("uses the odometer when there was no due km", () => {
    const n = nextOccurrence({ ...base, repeatKm: 5000 })!;
    expect(n.dueKm).toBe(95000);
  });

  it("clears a date that doesn't repeat", () => {
    const n = nextOccurrence({ ...base, dueKm: 92000, dueDate: d("2026-12-01"), repeatKm: 10000 })!;
    expect(n.dueDate).toBeNull();
  });
});

describe("recurrenceLabel", () => {
  it("names common periods", () => {
    expect(recurrenceLabel({ repeatMonths: 12, repeatKm: null })).toBe("anual");
    expect(recurrenceLabel({ repeatMonths: 1, repeatKm: null })).toBe("mensal");
    expect(recurrenceLabel({ repeatMonths: 6, repeatKm: null })).toBe("6 meses");
    expect(recurrenceLabel({ repeatMonths: null, repeatKm: 10000 })).toBe("10.000 km");
    expect(recurrenceLabel({ repeatMonths: null, repeatKm: null })).toBeNull();
  });
});
