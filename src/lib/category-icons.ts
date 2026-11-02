import type { MaintenanceCategory, UpgradeCategory } from "@prisma/client";
import { CircleDot, Cpu, Disc3, Droplet, Ellipsis, FlaskConical, Funnel, MoveVertical, Sparkles, Speaker, Wind, Wrench, Zap, type LucideIcon } from "lucide-react";

export const MAINTENANCE_ICONS: Record<MaintenanceCategory, LucideIcon> = {
  OIL: Droplet, FILTERS: Funnel, BRAKES: Disc3, TIRES: CircleDot,
  REVISION: Wrench, SUSPENSION: MoveVertical, ELECTRICAL: Zap,
  FLUIDS: FlaskConical, OTHER: Ellipsis,
};

export const UPGRADE_ICONS: Record<UpgradeCategory, LucideIcon> = {
  EXHAUST: Wind, WHEELS: CircleDot, ECU: Cpu, SUSPENSION: MoveVertical,
  AESTHETIC: Sparkles, AUDIO: Speaker, BRAKES: Disc3, OTHER: Ellipsis,
};
