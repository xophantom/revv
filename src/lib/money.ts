// Lenient BR money parser. Returns integer cents, never negative or non-finite (feeds an Int DB column).
// Separators: with both "," and ".", the last one is the decimal mark ("1.290,90", "1,290.90").
// A lone comma is decimal ("380,50"). A lone dot is decimal unless followed by exactly 3 digits,
// which is the BR thousands form ("89.9" / "1500.50" → decimal; "1.500" → 1500).
export function realToCents(input: string): number {
  const s = input.trim().replace(/^R\$\s*/i, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized: string;
  if (lastComma !== -1 && lastDot !== -1) {
    const [thousands, decimal] = lastComma > lastDot ? [".", ","] : [",", "."];
    normalized = s.split(thousands).join("").replace(decimal, ".");
  } else if (lastComma !== -1) {
    normalized = s.indexOf(",") === lastComma ? s.replace(",", ".") : s.split(",").join("");
  } else if (lastDot !== -1) {
    const singleDot = s.indexOf(".") === lastDot;
    normalized = singleDot && s.length - lastDot - 1 !== 3 ? s : s.split(".").join("");
  } else {
    normalized = s;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value * 100));
}
export function centsToBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
// Cents back to what the cost field accepts ("1500,50"); zero stays empty so the placeholder shows.
export function centsToInput(cents: number): string {
  return cents ? (cents / 100).toFixed(2).replace(".", ",") : "";
}
