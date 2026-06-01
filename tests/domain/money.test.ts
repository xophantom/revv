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
});
