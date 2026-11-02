import { computeAlerts, type AlertInput } from "@/domain/alerts";
import type { MaintenanceFormProps } from "@/components/maintenance/MaintenanceForm";
import { AlertActions } from "./AlertActions";

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

export function AlertChips({ input, form, register }: { input: AlertInput; form: MaintenanceFormProps; register?: string }) {
  const alerts = computeAlerts(input)
    .filter((a) => a.status !== "ok")
    .slice(0, 6)
    .map((a) => ({ id: a.id, label: a.label, status: a.status, source: a.source, detail: detail(a) }));
  return <AlertActions alerts={alerts} form={form} register={register} />;
}
