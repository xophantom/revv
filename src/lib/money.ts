// Lenient BR money parser: strips thousands dots, treats comma as decimal.
// Returns integer cents, never negative or non-finite (feeds an Int DB column).
export function realToCents(input: string): number {
  const normalized = input.trim().replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value * 100));
}
export function centsToBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
