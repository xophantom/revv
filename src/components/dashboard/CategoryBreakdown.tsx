import type { MaintenanceCategory, UpgradeCategory } from "@prisma/client";
import { Panel } from "@/components/ui/panel";
import type { CategoryTotal, FinanceSummary } from "@/domain/finance";
import { MAINTENANCE_LABELS, UPGRADE_LABELS } from "@/lib/categories";
import { MAINTENANCE_ICONS, UPGRADE_ICONS } from "@/lib/category-icons";
import { centsToBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

// Maintenance in accent, upgrades in a neutral tone; the UPG tag tells them apart without color.
const BAR = { maintenance: "bg-accent", upgrade: "bg-fg/70" } as const;
const ICON = { maintenance: "text-accent", upgrade: "text-fg/70" } as const;

function categoryMeta({ kind, category }: CategoryTotal) {
  const meta = kind === "maintenance"
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

type Props = Pick<FinanceSummary, "byCategory" | "maintenanceCents" | "upgradeCents" | "totalCents"> & { emptyLabel: string };

export function CategoryBreakdown({ byCategory, maintenanceCents, upgradeCents, totalCents, emptyLabel }: Props) {
  const max = byCategory[0]?.cents ?? 0;
  return (
    <Panel title="Por categoria" className="min-w-0">
      {!byCategory.length ? (
        <p className="mono text-sm text-muted">{emptyLabel}</p>
      ) : (
        <>
          <div className="mono mb-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
            <Legend kind="maintenance" label="Manutenção" cents={maintenanceCents} total={totalCents} />
            <Legend kind="upgrade" label="Upgrade" cents={upgradeCents} total={totalCents} />
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
                        <span className="mono shrink-0 rounded border border-border px-1 text-[11px] leading-4 text-muted">
                          <span aria-hidden>UPG</span>
                          <span className="sr-only">upgrade</span>
                        </span>
                      )}
                    </span>
                    <span className="mono shrink-0 tabular-nums">
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
