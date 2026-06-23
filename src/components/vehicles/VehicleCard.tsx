import Link from "next/link";
import { AnimatedCard } from "@/components/common/AnimatedCard";

export function VehicleCard({ v, i }: { v: { id: string; name: string; plate: string | null; year: number | null; currentKm: number; photoUrl: string | null }; i: number }) {
  return (
    <AnimatedCard i={i}>
      <Link href={`/garage/${v.id}`} className="block overflow-hidden rounded-xl border border-border bg-surface transition hover:-translate-y-1">
        <div className="h-40 bg-surface2 bg-cover bg-center" style={v.photoUrl ? { backgroundImage: `linear-gradient(0deg,rgba(0,0,0,.5),transparent),url(/api/vehicles/${v.id}/photo)` } : undefined} />
        <div className="p-4">
          <div className="text-xl font-bold">{v.name}</div>
          <div className="mono mt-1 text-xs text-muted">{v.plate ?? "—"} · {v.year ?? "—"} · {v.currentKm.toLocaleString("pt-BR")} km</div>
        </div>
      </Link>
    </AnimatedCard>
  );
}
