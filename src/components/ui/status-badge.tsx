import type { AlertStatus } from "@/domain/alerts";
import { cn } from "@/lib/utils";

// Overdue is filled, soon is outlined, missing history is dashed: severity reads without color alone.
export const STATUS_TONE: Record<AlertStatus, string> = {
  overdue: "border-accent bg-accent text-bg",
  soon: "border-accent/50 bg-accent/10 text-accent",
  unknown: "border-dashed border-white/20 text-muted",
  ok: "border-border text-fg/70",
};

export const STATUS_LABEL: Record<AlertStatus, string> = {
  overdue: "atrasado",
  soon: "em breve",
  unknown: "sem histórico",
  ok: "em dia",
};

export function StatusBadge({ status, children, className }: { status: AlertStatus; children?: React.ReactNode; className?: string }) {
  return (
    <span className={cn("mono inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px]", STATUS_TONE[status], className)}>
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {children ?? STATUS_LABEL[status]}
    </span>
  );
}
