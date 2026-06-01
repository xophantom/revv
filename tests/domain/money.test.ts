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
});
