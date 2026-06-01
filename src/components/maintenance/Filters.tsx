"use client";
import { useUi } from "@/store/ui";
import { MAINTENANCE_CATEGORIES, MAINTENANCE_LABELS } from "@/lib/categories";

const fieldClass = "rounded-lg border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent";

export function Filters() {
  const { maintFilter, setMaintFilter } = useUi();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={fieldClass}
        value={maintFilter.category ?? ""}
        onChange={(e) => setMaintFilter({ category: e.target.value || null })}
      >
        <option value="">Todas</option>
        {MAINTENANCE_CATEGORIES.map((c) => <option key={c} value={c}>{MAINTENANCE_LABELS[c]}</option>)}
      </select>
      <label className="mono text-[10px] text-muted">de</label>
      <input
        type="date"
        className={fieldClass}
        value={maintFilter.from ?? ""}
        onChange={(e) => setMaintFilter({ from: e.target.value || null })}
      />
      <label className="mono text-[10px] text-muted">até</label>
      <input
        type="date"
        className={fieldClass}
        value={maintFilter.to ?? ""}
        onChange={(e) => setMaintFilter({ to: e.target.value || null })}
      />
    </div>
  );
}
