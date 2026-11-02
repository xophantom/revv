import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Toggle chip for picking options (category, items done). `selected` maps to aria-pressed.
export function Chip({ selected = false, icon: Icon, className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <button type="button" aria-pressed={selected} className={cn(
      "tabular-nums inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors",
      "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50",
      selected ? "border-accent bg-accent/15 text-accent" : "border-border text-muted hover:border-white/25 hover:text-fg",
      className,
    )} {...props}>
      {Icon && <Icon size={13} aria-hidden className="shrink-0" />}
      {children}
    </button>
  );
}
