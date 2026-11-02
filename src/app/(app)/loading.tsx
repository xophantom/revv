// Skeleton of a page header plus a card grid (the garage's shape), shown while a section loads.
export default function Loading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <div aria-hidden className="motion-safe:animate-pulse">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="h-9 w-40 rounded-lg bg-surface2" />
          <div className="h-10 w-28 rounded-lg bg-surface2" />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border bg-surface">
              <div className="h-40 bg-surface2" />
              <div className="space-y-2 p-4">
                <div className="h-6 w-2/3 rounded bg-surface2" />
                <div className="h-3 w-1/2 rounded bg-surface2" />
                <div className="mt-3 flex justify-between border-t border-border pt-3">
                  <div className="h-3 w-20 rounded bg-surface2" />
                  <div className="h-3 w-16 rounded bg-surface2" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="tabular-nums mt-6 text-xs text-muted">{"// carregando…"}</p>
      </div>
    </div>
  );
}
