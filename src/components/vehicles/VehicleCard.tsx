import Link from "next/link";
import { AnimatedCard } from "@/components/common/AnimatedCard";
import { StatusBadge } from "@/components/ui/status-badge";
import { centsToBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

export type VehicleCardStats = { overdue: number; soon: number; totalCents: number };

// Overdue wins; soon only shows when nothing is overdue; all clear shows nothing.
function AlertBadge({ overdue, soon }: Pick<VehicleCardStats, "overdue" | "soon">) {
  if (overdue) return <StatusBadge status="overdue" className="mt-1.5 shrink-0">{overdue} {overdue === 1 ? "atrasado" : "atrasados"}</StatusBadge>;
  if (soon) return <StatusBadge status="soon" className="mt-1.5 shrink-0">{soon} em breve</StatusBadge>;
  return null;
}

export function VehicleCard({ v, stats, i }: {
  v: { id: string; name: string; plate: string | null; year: number | null; currentKm: number; photoUrl: string | null; photoKey: string | null };
  stats: VehicleCardStats;
  i: number;
}) {
  return (
    <AnimatedCard i={i}>
      <Link href={`/garage/${v.id}`} className="block overflow-hidden rounded-xl border border-border bg-surface transition hover:-translate-y-1">
        <div className="relative h-40 bg-surface2">
          {v.photoUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- auth-gated route: next/image's optimizer can't send the session */}
              <img
                src={`/api/vehicles/${v.id}/photo?v=${encodeURIComponent(v.photoKey ?? "")}`}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div aria-hidden className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent" />
            </>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 break-words text-xl font-bold">{v.name}</div>
            <AlertBadge overdue={stats.overdue} soon={stats.soon} />
          </div>
          <div className="mono mt-1 text-xs text-muted">{[v.plate, v.year, `${v.currentKm.toLocaleString("pt-BR")} km`].filter(Boolean).join(" · ")}</div>
          <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-border pt-3">
            <span className="mono text-[11px] uppercase tracking-wider text-muted">Gasto total</span>
            <span className={cn("mono text-sm font-bold", stats.totalCents ? "text-accent" : "text-muted")}>{centsToBRL(stats.totalCents)}</span>
          </div>
        </div>
      </Link>
    </AnimatedCard>
  );
}
