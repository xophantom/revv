import type { Alert } from "@/domain/alerts";

export const formatKm = (n: number) => `${n.toLocaleString("pt-BR")} km`;

// Under ~2 months shows days; beyond that, rounded months.
export function timeSpan(days: number): string {
  const n = Math.abs(days);
  if (n < 60) return n === 1 ? "1 dia" : `${n} dias`;
  const months = Math.round(n / 30.44);
  return months === 1 ? "1 mês" : `${months} meses`;
}

// Time left (or past) on a due date: "faltam 45 dias", "vence hoje", "venceu há 3 dias".
export function dueIn(days: number): string {
  if (days === 0) return "vence hoje";
  return days > 0 ? `faltam ${timeSpan(days)}` : `venceu há ${timeSpan(days)}`;
}

// Km left (or past): "faltam 1.300 km", "passou 1.200 km".
export function kmLeft(km: number): string {
  return km >= 0 ? `faltam ${formatKm(km)}` : `passou ${formatKm(-km)}`;
}

// One-line state of an alert, along the dimension that set its status.
export function alertDetail(a: Pick<Alert, "status" | "driver" | "remainingKm" | "remainingDays">): string {
  if (a.status === "unknown") return "sem histórico";
  if (a.driver === "km" && a.remainingKm != null) return kmLeft(a.remainingKm);
  if (a.driver === "time" && a.remainingDays != null) return dueIn(a.remainingDays);
  return "";
}
