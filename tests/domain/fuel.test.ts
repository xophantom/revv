import { describe, it, expect } from "vitest";
import {
  fuelReadings, summarizeFuel, sortFuel, pricePerLiterCents, litersToMl, formatKmPerLiter, formatLiters,
  type FuelFill,
} from "@/domain/fuel";

type Fill = FuelFill & { id: string };
const fill = (id: string, date: string, km: number, liters: number, costCents: number, fullTank = true): Fill => ({
  id, date: new Date(date), km, volumeMl: litersToMl(liters), costCents, fullTank,
});
const byId = <T extends { id: string }>(rows: T[]) => Object.fromEntries(rows.map((r) => [r.id, r]));

describe("fuelReadings", () => {
  it("gives the first full tank no reading", () => {
    const [first] = fuelReadings([fill("a", "2026-01-01", 10000, 40, 24000)]);
    expect(first.kmPerLiter).toBeNull();
    expect(first.span).toBeNull();
    expect(first.liters).toBe(40);
    expect(first.pricePerLiterCents).toBe(600);
  });

  it("measures a full tank from the previous full tank", () => {
    const rows = fuelReadings([fill("a", "2026-01-01", 10000, 40, 24000), fill("b", "2026-01-15", 10500, 50, 30000)]);
    expect(rows[1].kmPerLiter).toBe(10);
    expect(rows[1].span).toEqual({ km: 500, volumeMl: 50000, costCents: 30000, priced: true });
  });

  it("accumulates partial fills into the next full tank's reading", () => {
    const rows = byId(fuelReadings([
      fill("a", "2026-01-01", 10000, 40, 24000),
      fill("p1", "2026-01-05", 10200, 10, 6000, false),
      fill("p2", "2026-01-09", 10400, 15, 9000, false),
      fill("b", "2026-01-15", 10600, 25, 15000),
    ]));
    expect(rows.p1.kmPerLiter).toBeNull();
    expect(rows.p2.kmPerLiter).toBeNull();
    expect(rows.b.kmPerLiter).toBe(12); // 600 km ÷ (10 + 15 + 25) L
    expect(rows.b.span).toEqual({ km: 600, volumeMl: 50000, costCents: 30000, priced: true });
  });

  it("ignores partial fills before the first full tank", () => {
    const rows = fuelReadings([
      fill("p", "2026-01-01", 9800, 20, 12000, false),
      fill("a", "2026-01-02", 10000, 40, 24000),
      fill("b", "2026-01-20", 10400, 40, 24000),
    ]);
    expect(rows.map((r) => r.kmPerLiter)).toEqual([null, null, 10]);
  });

  it("sorts by date, then km, whatever the input order", () => {
    const fills = [
      fill("c", "2026-02-01", 11000, 50, 30000),
      fill("a", "2026-01-01", 10000, 40, 24000),
      fill("b2", "2026-01-15", 10600, 10, 6000),
      fill("b1", "2026-01-15", 10500, 50, 30000),
    ];
    expect(sortFuel(fills).map((f) => f.id)).toEqual(["a", "b1", "b2", "c"]);
    const rows = byId(fuelReadings(fills));
    expect(rows.b1.kmPerLiter).toBe(10);
    expect(rows.b2.kmPerLiter).toBe(10);
    expect(rows.c.kmPerLiter).toBe(8);
  });

  it("slots a fill logged late into its place by date", () => {
    // The 15/01 fill was entered after the 01/02 one; it splits the span, not appends to it.
    const rows = byId(fuelReadings([
      fill("a", "2026-01-01", 10000, 40, 24000),
      fill("c", "2026-02-01", 11000, 40, 24000),
      fill("b", "2026-01-15", 10500, 50, 30000),
    ]));
    expect(rows.b.kmPerLiter).toBe(10);
    expect(rows.c.kmPerLiter).toBe(12.5);
  });

  it("gives no reading when the odometer did not advance, and measures the next span from there", () => {
    const rows = byId(fuelReadings([
      fill("a", "2026-01-01", 10000, 40, 24000),
      fill("typo", "2026-01-10", 9500, 30, 18000),
      fill("same", "2026-01-11", 9500, 2, 1200),
      fill("c", "2026-01-20", 9900, 40, 24000),
    ]));
    expect(rows.typo.kmPerLiter).toBeNull();
    expect(rows.same.kmPerLiter).toBeNull();
    expect(rows.c.kmPerLiter).toBe(10);
    expect(Object.values(rows).every((r) => r.kmPerLiter == null || (Number.isFinite(r.kmPerLiter) && r.kmPerLiter > 0))).toBe(true);
  });

  it("guards against a span with zero liters", () => {
    const rows = fuelReadings([
      fill("a", "2026-01-01", 10000, 40, 24000),
      fill("b", "2026-01-15", 10500, 0, 0),
      fill("c", "2026-02-01", 11000, 50, 30000),
    ]);
    expect(rows[1].kmPerLiter).toBeNull();
    expect(rows[1].pricePerLiterCents).toBeNull();
    expect(rows[2].kmPerLiter).toBe(10);
  });
});

describe("summarizeFuel", () => {
  const history = [
    fill("a", "2026-01-01", 10000, 40, 24000),
    fill("b", "2026-01-15", 10500, 50, 30000), // 10 km/l
    fill("p", "2026-01-20", 10700, 20, 13000, false),
    fill("c", "2026-02-01", 11100, 30, 18000), // 600 km ÷ 50 L = 12 km/l
  ];

  it("averages distance between the first and last full tanks over the liters in that span", () => {
    const s = summarizeFuel(history);
    expect(s.avgKmPerLiter).toBeCloseTo(1100 / 100); // not the mean of 10 and 12
    expect(s.lastKmPerLiter).toBe(12);
  });

  it("prices fuel per km over the measured spans only", () => {
    // The first tank's R$ 240 was already in the tank when the measurement started.
    expect(summarizeFuel(history).costPerKmCents).toBe(Math.round((30000 + 13000 + 18000) / 1100));
  });

  it("totals spend, liters and the average price per liter", () => {
    const s = summarizeFuel(history);
    expect(s.totalCents).toBe(85000);
    expect(s.totalLiters).toBe(140);
    expect(s.avgPricePerLiterCents).toBe(Math.round(85000 / 140));
    expect(s.fills).toBe(4);
  });

  it("leaves unpriced fills out of the average price", () => {
    const s = summarizeFuel([fill("a", "2026-01-01", 10000, 40, 24000), fill("b", "2026-01-15", 10500, 50, 0)]);
    expect(s.records[1].pricePerLiterCents).toBeNull();
    expect(s.avgPricePerLiterCents).toBe(600);
  });

  it("skips impossible spans in the average", () => {
    const s = summarizeFuel([
      fill("a", "2026-01-01", 10000, 40, 24000),
      fill("typo", "2026-01-10", 9000, 30, 18000),
      fill("c", "2026-01-20", 9400, 40, 24000), // 10 km/l from the typo'd reading
      fill("d", "2026-02-01", 9900, 25, 15000), // 20 km/l
    ]);
    expect(s.avgKmPerLiter).toBeCloseTo(900 / 65);
    expect(s.lastKmPerLiter).toBe(20);
  });

  it("drops a reading from a km typo and recovers within two fills", () => {
    const normal = Array.from({ length: 4 }, (_, i) => fill(`n${i}`, `2026-0${i + 1}-01`, 10000 + i * 500, 40, 24000));
    // 50.000 typed as 500.000: the span is absurd (and the next one negative), so neither counts
    const s = summarizeFuel([...normal, fill("typo", "2026-05-01", 500000, 40, 24000), fill("x", "2026-06-01", 51000, 40, 24000), fill("y", "2026-07-01", 51500, 40, 24000)]);
    expect(s.records.find((r) => r.id === "typo")!.kmPerLiter).toBeNull();
    expect(s.records.find((r) => r.id === "x")!.kmPerLiter).toBeNull();
    expect(s.avgKmPerLiter).toBeCloseTo(12.5);
    expect(s.lastKmPerLiter).toBeCloseTo(12.5);
  });

  it("leaves spans with an unpriced fill out of the cost per km", () => {
    const s = summarizeFuel([fill("a", "2026-01-01", 1000, 40, 25000), fill("b", "2026-02-01", 1500, 40, 25000), fill("c", "2026-03-01", 2000, 40, 0)]);
    expect(s.costPerKmCents).toBe(50); // R$ 250 over 500 km; the free-looking span is ignored
    expect(s.avgKmPerLiter).toBeCloseTo(12.5); // consumption still counts it
  });

  it("has no consumption with fewer than two full tanks", () => {
    for (const fills of [[], [fill("a", "2026-01-01", 10000, 40, 24000)], [fill("p", "2026-01-01", 10000, 40, 24000, false), fill("q", "2026-01-09", 10400, 30, 18000, false)]]) {
      const s = summarizeFuel(fills);
      expect(s.avgKmPerLiter).toBeNull();
      expect(s.lastKmPerLiter).toBeNull();
      expect(s.costPerKmCents).toBeNull();
    }
    expect(summarizeFuel([]).avgPricePerLiterCents).toBeNull();
  });
});

describe("units", () => {
  it("rounds liters to the milliliter and prices to the cent", () => {
    expect(litersToMl(42.1234)).toBe(42123);
    expect(pricePerLiterCents(25000, 42123)).toBe(593); // 593,49...
    expect(pricePerLiterCents(25000, 0)).toBeNull();
  });

  it("formats in pt-BR", () => {
    expect(formatKmPerLiter(11.44)).toBe("11,4 km/l");
    expect(formatKmPerLiter(10)).toBe("10,0 km/l");
    expect(formatLiters(42.15)).toBe("42,15 L");
    expect(formatLiters(40)).toBe("40 L");
  });
});
