import { describe, it, expect } from "vitest";
import { formatDateOnly, daysBetween, addMonthsUTC, monthsBetweenUTC } from "@/lib/dates";

describe("dates", () => {
  it("formats a stored calendar date by its UTC day, regardless of process timezone", () => {
    // z.coerce.date("2026-11-01") → UTC midnight; local formatting in BRT used to show 31/10
    expect(formatDateOnly(new Date("2026-11-01"), "dd/MM/yyyy")).toBe("01/11/2026");
    expect(formatDateOnly("2026-11-01T00:00:00.000Z", "dd MMM yyyy")).toBe("01 nov 2026");
  });
  it("counts calendar days between dates", () => {
    expect(daysBetween(new Date("2026-11-20"), new Date("2026-11-02"))).toBe(-18);
    expect(daysBetween(new Date("2026-02-01"), new Date("2026-03-01"))).toBe(28);
  });
  it("adds months clamping to month end", () => {
    expect(addMonthsUTC(new Date("2026-01-31"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(addMonthsUTC(new Date("2026-11-15"), 3).toISOString().slice(0, 10)).toBe("2027-02-15");
  });
  it("counts calendar months ignoring the day", () => {
    expect(monthsBetweenUTC(new Date("2026-01-31"), new Date("2026-11-01"))).toBe(10);
  });
});
