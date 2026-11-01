import { describe, it, expect } from "vitest";
import { realToCents, centsToBRL } from "@/lib/money";

describe("money", () => {
  it("parses reais string to integer cents", () => {
    expect(realToCents("380")).toBe(38000);
    expect(realToCents("380,50")).toBe(38050);
    expect(realToCents("1.290,90")).toBe(129090);
  });
  it("formats cents as BRL", () => {
    expect(centsToBRL(38000)).toMatch(/R\$\s?380,00/);
    expect(centsToBRL(129090)).toMatch(/R\$\s?1\.290,90/);
  });
  it("returns 0 for empty or garbage input", () => {
    expect(realToCents("")).toBe(0);
    expect(realToCents("abc")).toBe(0);
  });
  it("never returns negative or non-finite cents", () => {
    expect(realToCents("-50")).toBe(0);
    expect(realToCents("Infinity")).toBe(0);
  });
  it("treats a lone dot as decimal unless it is the BR thousands form", () => {
    expect(realToCents("1500.50")).toBe(150050);
    expect(realToCents("89.9")).toBe(8990);
    expect(realToCents("1.50")).toBe(150);
    expect(realToCents("1.500")).toBe(150000);
    expect(realToCents("1.500.000")).toBe(150000000);
  });
  it("uses the last separator as decimal when both appear", () => {
    expect(realToCents("1,290.90")).toBe(129090);
    expect(realToCents("1.234.567,89")).toBe(123456789);
  });
  it("accepts an R$ prefix", () => {
    expect(realToCents("R$ 1.290,90")).toBe(129090);
  });
});
