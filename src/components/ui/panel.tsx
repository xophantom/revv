import { cn } from "@/lib/utils";

// Bordered block with a small mono caption (dashboard cards, charts).
export function Panel({ title, action, className, children }: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-surface p-4", className)}>
      {(title || action) && (
        <header className="mb-3 flex min-h-7 flex-wrap items-center justify-between gap-2">
          {title && <h2 className="mono text-[11px] uppercase tracking-wider text-muted">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

// Page section title in the "// FICHA DE TROCA" style.
export function SectionHeading({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex min-h-8 flex-wrap items-center justify-between gap-2", className)}>
      <h2 className="mono text-xs uppercase tracking-widest text-accent">{"// "}{children}</h2>
      {action}
    </div>
  );
}
