import { computeAlerts, type AlertInput } from "@/domain/alerts";

const STYLE: Record<string, string> = {
  overdue: "bg-accent/20 border-accent text-accent",
  soon: "bg-accent/10 border-accent/40 text-accent",
  unknown: "border-border text-muted",
};
// Under ~2 months shows days; beyond that, rounded months.
function timeSpan(days: number): string {
  const n = Math.abs(days);
  if (n < 60) return n === 1 ? "1 dia" : `${n} dias`;
  const months = Math.round(n / 30.44);
  return months === 1 ? "1 mês" : `${months} meses`;
}
function detail(a: ReturnType<typeof computeAlerts>[number]): string {
  if (a.status === "unknown") return "sem histórico";
  if (a.driver === "km" && a.remainingKm != null)
    return `${a.remainingKm < 0 ? "há" : "em"} ${Math.abs(a.remainingKm).toLocaleString("pt-BR")} km`;
  if (a.driver === "time" && a.remainingDays != null) {
    if (a.remainingDays === 0) return "vence hoje";
    return `${a.remainingDays < 0 ? "há" : "em"} ${timeSpan(a.remainingDays)}`;
  }
  return "";
}
export function AlertChips(input: AlertInput) {
  const alerts = computeAlerts(input).filter((a) => a.status !== "ok").slice(0, 6);
  if (!alerts.length) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {alerts.map((a) => (
        <span key={a.id} className={`mono flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] ${STYLE[a.status] ?? STYLE.unknown}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" /> {a.label} · {detail(a)}
        </span>
      ))}
    </div>
  );
}
