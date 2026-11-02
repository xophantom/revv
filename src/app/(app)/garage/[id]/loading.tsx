// Vehicle page skeleton: hero, then the spec cards. Without it, going from the garage to a vehicle
// keeps the garage on screen until the (heavier) vehicle page is ready.
export default function VehicleLoading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <div aria-hidden className="motion-safe:animate-pulse">
        <div className="mb-4 h-3 w-20 rounded bg-surface2" />
        <div className="mb-8 grid gap-6 md:grid-cols-[300px_1fr]">
          <div className="h-48 rounded-xl bg-surface2" />
          <div className="space-y-3">
            <div className="h-10 w-56 rounded-lg bg-surface2" />
            <div className="h-6 w-72 max-w-full rounded bg-surface2" />
            <div className="h-4 w-40 rounded bg-surface2" />
            <div className="flex gap-2 pt-2">
              <div className="h-5 w-24 rounded-md bg-surface2" />
              <div className="h-5 w-20 rounded-md bg-surface2" />
            </div>
          </div>
        </div>
        <div className="mb-3 h-3 w-32 rounded bg-surface2" />
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-3 rounded-[10px] border border-border bg-surface p-3.5">
              <div className="h-3 w-24 rounded bg-surface2" />
              <div className="h-5 w-32 rounded bg-surface2" />
              <div className="h-2.5 rounded bg-surface2" />
              <div className="h-3 w-full rounded bg-surface2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
