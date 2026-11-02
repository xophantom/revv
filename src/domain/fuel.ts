// Fuel log math. Consumption (km/l) is measured between full tanks: a full tank closes the span
// that started at the previous full tank, and every liter added in between (partial fills plus
// this one) was burned over that distance. Prisma rows fit as they are.

export type FuelFill = {
  date: Date; // UTC midnight
  km: number;
  volumeMl: number; // liters × 1000
  costCents: number; // total paid
  fullTank: boolean;
};

// One measured span: previous full tank → this full tank. `priced`: every fill in it has a price.
export type FuelSpan = { km: number; volumeMl: number; costCents: number; priced: boolean };

// Beyond these a reading is a typo (an extra zero on the km, liters for cents), not a car.
export const MIN_KM_PER_LITER = 2;
export const MAX_KM_PER_LITER = 80;

export type FuelDerived = {
  liters: number;
  pricePerLiterCents: number | null; // null without volume or without a price
  kmPerLiter: number | null; // only on a full tank that closes a valid span
  span: FuelSpan | null; // set together with kmPerLiter
};

export type FuelSummary<T extends FuelFill = FuelFill> = {
  records: (T & FuelDerived)[]; // oldest first
  avgKmPerLiter: number | null; // over every valid span
  lastKmPerLiter: number | null; // most recent valid span
  costPerKmCents: number | null; // fuel paid over valid spans ÷ their distance
  avgPricePerLiterCents: number | null; // over priced fills
  totalCents: number;
  totalLiters: number;
  fills: number;
};

export const litersOf = (volumeMl: number) => volumeMl / 1000;
// Liters typed in the form → the Int column (rounded to the milliliter).
export const litersToMl = (liters: number) => Math.round(liters * 1000);

// A fill saved without a price (R$ 0) has no price per liter rather than a free one.
export function pricePerLiterCents(costCents: number, volumeMl: number): number | null {
  return volumeMl > 0 && costCents > 0 ? Math.round((costCents * 1000) / volumeMl) : null;
}

// Date first; same-day fills by odometer.
export function sortFuel<T extends FuelFill>(records: readonly T[]): T[] {
  return [...records].sort((a, b) => a.date.getTime() - b.date.getTime() || a.km - b.km);
}

// Per-record values, oldest first. Every full tank becomes the next span's start, even when its
// own span is impossible (odometer didn't advance, or no liters): that span just has no reading,
// so a typo can't produce Infinity or a negative km/l.
export function fuelReadings<T extends FuelFill>(records: readonly T[]): (T & FuelDerived)[] {
  let startKm: number | null = null; // last full tank seen
  let ml = 0;
  let cents = 0;
  let priced = true;
  return sortFuel(records).map((r) => {
    const out: T & FuelDerived = {
      ...r,
      liters: litersOf(r.volumeMl),
      pricePerLiterCents: pricePerLiterCents(r.costCents, r.volumeMl),
      kmPerLiter: null,
      span: null,
    };
    if (startKm == null) {
      // Fuel added before the first full tank belongs to no span.
      if (r.fullTank) startKm = r.km;
      return out;
    }
    ml += Math.max(0, r.volumeMl);
    cents += Math.max(0, r.costCents);
    priced &&= r.costCents > 0;
    if (!r.fullTank) return out;
    const km = r.km - startKm;
    const kmPerLiter = ml > 0 ? km / litersOf(ml) : 0;
    if (kmPerLiter >= MIN_KM_PER_LITER && kmPerLiter <= MAX_KM_PER_LITER) {
      out.kmPerLiter = kmPerLiter;
      out.span = { km, volumeMl: ml, costCents: cents, priced };
    }
    startKm = r.km;
    ml = 0;
    cents = 0;
    priced = true;
    return out;
  });
}

export function summarizeFuel<T extends FuelFill>(records: readonly T[]): FuelSummary<T> {
  const rows = fuelReadings(records);
  const spans = rows.flatMap((r) => (r.span ? [r.span] : []));
  const spanKm = spans.reduce((a, s) => a + s.km, 0);
  const spanMl = spans.reduce((a, s) => a + s.volumeMl, 0);
  // Spans with an unpriced fill would count their km as free.
  const pricedSpans = spans.filter((s) => s.priced);
  const pricedKm = pricedSpans.reduce((a, s) => a + s.km, 0);
  const pricedSpanCents = pricedSpans.reduce((a, s) => a + s.costCents, 0);
  const totalCents = rows.reduce((a, r) => a + r.costCents, 0);
  const totalMl = rows.reduce((a, r) => a + Math.max(0, r.volumeMl), 0);
  const priced = rows.filter((r) => r.pricePerLiterCents != null);
  const pricedMl = priced.reduce((a, r) => a + r.volumeMl, 0);
  const pricedCents = priced.reduce((a, r) => a + r.costCents, 0);
  const last = rows.findLast((r) => r.kmPerLiter != null);
  return {
    records: rows,
    // Summed distance over summed liters, not a mean of readings: a long span weighs more than a short one.
    avgKmPerLiter: spanMl > 0 ? spanKm / litersOf(spanMl) : null,
    lastKmPerLiter: last?.kmPerLiter ?? null,
    costPerKmCents: pricedKm > 0 ? Math.round(pricedSpanCents / pricedKm) : null,
    avgPricePerLiterCents: pricePerLiterCents(pricedCents, pricedMl),
    totalCents,
    totalLiters: litersOf(totalMl),
    fills: rows.length,
  };
}

const oneDecimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const upToTwoDecimals = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

// "11,4 km/l"
export const formatKmPerLiter = (v: number) => `${oneDecimal.format(v)} km/l`;
// "42,15 L"
export const formatLiters = (v: number) => `${upToTwoDecimals.format(v)} L`;
