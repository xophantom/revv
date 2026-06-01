import { z } from "zod";
const km = z.number().int().min(0).optional();
const months = z.number().int().min(0).optional();

export const vehicleSpecSchema = z.object({
  engineOil: z.object({ type: z.string().optional(), brand: z.string().optional(), capacityL: z.number().min(0).optional(), intervalKm: km, intervalMonths: months }).optional(),
  oilFilter: z.object({ brand: z.string().optional(), note: z.string().optional() }).optional(),
  transmissionOil: z.object({ type: z.string().optional(), intervalKm: km }).optional(),
  airFilter: z.object({ intervalKm: km }).optional(),
  fuelFilter: z.object({ intervalKm: km }).optional(),
  cabinFilter: z.object({ intervalKm: km }).optional(),
  timingBelt: z.object({ kind: z.enum(["chain", "belt"]).optional(), intervalKm: km, lastChangeKm: km }).optional(),
  tires: z.object({ size: z.string().optional(), psiFront: z.number().min(0).optional(), psiRear: z.number().min(0).optional(), rotationKm: km }).optional(),
  sparkPlugs: z.object({ type: z.string().optional(), intervalKm: km }).optional(),
  brakeFluid: z.object({ type: z.enum(["DOT3", "DOT4", "DOT5.1"]).optional(), intervalMonths: months }).optional(),
  coolant: z.object({ type: z.string().optional(), intervalMonths: months }).optional(),
  freeNotes: z.string().optional(),
}).strict();

export type VehicleSpecData = z.infer<typeof vehicleSpecSchema>;
export const emptySpec = (): VehicleSpecData => ({});
