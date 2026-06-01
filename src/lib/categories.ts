import type { MaintenanceCategory, UpgradeCategory } from "@prisma/client";

export const MAINTENANCE_LABELS: Record<MaintenanceCategory, string> = {
  OIL: "Óleo", FILTERS: "Filtros", BRAKES: "Freios", TIRES: "Pneus",
  REVISION: "Revisão", SUSPENSION: "Suspensão", ELECTRICAL: "Elétrica",
  FLUIDS: "Fluidos", OTHER: "Outro",
};
export const UPGRADE_LABELS: Record<UpgradeCategory, string> = {
  EXHAUST: "Escape", WHEELS: "Rodas", ECU: "ECU/Remap", SUSPENSION: "Suspensão",
  AESTHETIC: "Estética", AUDIO: "Som", BRAKES: "Freios", OTHER: "Outro",
};
export const MAINTENANCE_CATEGORIES = Object.keys(MAINTENANCE_LABELS) as MaintenanceCategory[];
export const UPGRADE_CATEGORIES = Object.keys(UPGRADE_LABELS) as UpgradeCategory[];
