import { describe, it, expect } from "vitest";
import { vehicleSpecSchema, emptySpec } from "@/domain/spec-schema";

describe("vehicleSpecSchema", () => {
  it("accepts a partial spec", () => {
    const r = vehicleSpecSchema.safeParse({ engineOil: { type: "5W30", intervalKm: 10000 } });
    expect(r.success).toBe(true);
  });
  it("accepts the empty spec", () => {
    expect(vehicleSpecSchema.safeParse(emptySpec()).success).toBe(true);
  });
  it("rejects negative intervals", () => {
    const r = vehicleSpecSchema.safeParse({ engineOil: { intervalKm: -5 } });
    expect(r.success).toBe(false);
  });
});
