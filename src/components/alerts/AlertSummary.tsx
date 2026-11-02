import type { Alert, AlertStatus } from "@/domain/alerts";
import { StatusBadge } from "@/components/ui/status-badge";

const LABEL: Record<Exclude<AlertStatus, "ok">, (n: number) => string> = {
  overdue: (n) => (n === 1 ? "1 atrasado" : `${n} atrasados`),
  soon: (n) => `${n} em breve`,
  unknown: (n) => `${n} sem histórico`,
};

// Hero counter for the alerts; the detail lives in the spec cards and the custom alert list.
// Each count jumps to the spec cards, or to the custom list when only custom alerts are in it.
export function AlertSummary({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) return null;
  const groups = (["overdue", "soon", "unknown"] as const)
    .map((status) => ({ status, list: alerts.filter((a) => a.status === status) }))
    .filter((g) => g.list.length > 0);
  if (!groups.length) return <div className="mt-4"><StatusBadge status="ok">tudo em dia</StatusBadge></div>;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {groups.map(({ status, list }) => (
        <a key={status} href={list.some((a) => a.source === "spec") ? "#ficha" : "#alertas"} className="rounded-md transition hover:opacity-80">
          <StatusBadge status={status}>{LABEL[status](list.length)}</StatusBadge>
        </a>
      ))}
    </div>
  );
}
