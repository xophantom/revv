import { cn } from "@/lib/utils";

// One-of-few switch (period presets and the like).
export function Segmented<T extends string>({ value, onChange, options, className, "aria-label": ariaLabel }: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn("inline-flex rounded-lg border border-border bg-surface p-0.5", className)}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}
          className={cn(
            "tabular-nums h-7 cursor-pointer rounded-md px-2.5 text-[11px] uppercase tracking-wide transition-colors",
            "focus-visible:outline-2 focus-visible:outline-accent",
            o.value === value ? "bg-surface2 text-accent" : "text-muted hover:text-fg",
          )}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
