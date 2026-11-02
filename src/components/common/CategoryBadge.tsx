import type { LucideIcon } from "lucide-react";

export function CategoryBadge({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="mono inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] text-muted">
      <Icon size={11} aria-hidden />
      {label}
    </span>
  );
}
