import type { MaintenanceCategory, UpgradeCategory } from "@prisma/client";
import { Panel } from "@/components/ui/panel";
import type { CategoryTotal, FinanceSummary } from "@/domain/finance";
import { FUEL_CATEGORY_LABEL, MAINTENANCE_LABELS, UPGRADE_LABELS } from "@/lib/categories";
import { FUEL_ICON, MAINTENANCE_ICONS, UPGRADE_ICONS } from "@/lib/category-icons";
import { centsToBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

// Maintenance in accent, upgrades in a neutral tone, fuel in a cool blue that stays apart from both
// (checked for color-vision deficiency on the dark surface). The UPG tag and the "Combustível"
// label tell them apart without color.
const BAR = { maintenance: "bg-accent", upgrade: "bg-fg/70", fuel: "bg-blue-400" } as const;
const ICON = { maintenance: "text-accent", upgrade: "text-fg/70", fuel: "text-blue-400" } as const;

function categoryMeta({ kind, category }: CategoryTotal) {
  const meta = kind === "fuel"
    ? { label: FUEL_CATEGORY_LABEL, Icon: FUEL_ICON }
    : kind === "maintenance"
      ? { label: MAINTENANCE_LABELS[category as MaintenanceCategory], Icon: MAINTENANCE_ICONS[category as MaintenanceCategory] }
      : { label: UPGRADE_LABELS[category as UpgradeCategory], Icon: UPGRADE_ICONS[category as UpgradeCategory] };
  return { label: meta.label ?? category, Icon: meta.Icon ?? MAINTENANCE_ICONS.OTHER };
}

function share(cents: number, total: number): string {
  if (!total || !cents) return "0%";
  const pct = Math.round((cents / total) * 100);
  return pct < 1 ? "<1%" : `${pct}%`;
}

function Legend({ kind, label, cents, total }: { kind: CategoryTotal["kind"]; label: string; cents: number; total: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("h-2 w-2 rounded-sm", BAR[kind])} />
      {label}
      <span className="text-fg tabular-nums">{centsToBRL(cents)}</span>
      <span className="tabular-nums">{share(cents, total)}</span>
    </span>
  );
}

type Props = Pick<FinanceSummary, "byCategory" | "maintenanceCents" | "upgradeCents" | "fuelCents" | "totalCents"> & { emptyLabel: string };

export function CategoryBreakdown({ byCategory, maintenanceCents, upgradeCents, fuelCents, totalCents, emptyLabel }: Props) {
  const max = byCategory[0]?.cents ?? 0;
  return (
    <Panel title="Por categoria" className="min-w-0">
      {!byCategory.length ? (
        <p className="tabular-nums text-sm text-muted">{emptyLabel}</p>
      ) : (
        <>
          <div className="tabular-nums mb-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
            <Legend kind="maintenance" label="Manutenção" cents={maintenanceCents} total={totalCents} />
            <Legend kind="upgrade" label="Upgrade" cents={upgradeCents} total={totalCents} />
            {/* Only once there's fuel spend, so a garage that doesn't log fills keeps the two-way split. */}
            {fuelCents > 0 && <Legend kind="fuel" label={FUEL_CATEGORY_LABEL} cents={fuelCents} total={totalCents} />}
          </div>
          <ul className="space-y-3">
            {byCategory.map((c) => {
              const { label, Icon } = categoryMeta(c);
              return (
                <li key={`${c.kind}:${c.category}`}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon size={14} aria-hidden className={cn("shrink-0", ICON[c.kind])} />
                      <span className="truncate">{label}</span>
                      {c.kind === "upgrade" && (
                        <span className="tabular-nums shrink-0 rounded border border-border px-1 text-[11px] leading-4 text-muted">
                          <span aria-hidden>UPG</span>
                          <span className="sr-only">upgrade</span>
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {centsToBRL(c.cents)} <span className="text-[11px] text-muted">{share(c.cents, totalCents)}</span>
                    </span>
                  </div>
                  <div aria-hidden className="mt-1.5 h-1.5 rounded-full bg-white/[.06]">
                    <div className={cn("h-full rounded-full", BAR[c.kind])} style={{ width: `${(c.cents / max) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Panel>
  );
}
