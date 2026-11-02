"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Pencil, Trash2 } from "lucide-react";
import { toggleCustomAlertDone, deleteCustomAlert } from "@/actions/alerts";
import type { AlertStatus } from "@/domain/alerts";
import { isRecurring, recurrenceLabel } from "@/domain/recurrence";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateOnly } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { CustomAlertForm } from "./CustomAlertForm";

export type CustomAlertRecord = {
  id: string;
  label: string;
  dueKm: number | null;
  dueDate: string | null;
  done: boolean;
  repeatMonths: number | null; // recurring: completing it rolls the due date/km forward
  repeatKm: number | null;
  status?: AlertStatus; // computed state; absent once done
  detail?: string;
};

function dueText({ dueKm, dueDate }: { dueKm: number | null; dueDate: string | null }): string[] {
  const out: string[] = [];
  if (dueKm != null) out.push(`${dueKm.toLocaleString("pt-BR")} km`);
  if (dueDate) out.push(formatDateOnly(dueDate, "dd/MM/yyyy"));
  return out;
}

function AlertItem({ alert, vehicleId }: { alert: CustomAlertRecord; vehicleId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  const repeat = recurrenceLabel(alert);
  // A pending recurring item is an action (complete and reschedule), not an on/off toggle.
  const rolls = !alert.done && isRecurring(alert);

  function onToggle() {
    startTransition(async () => {
      const res = await toggleCustomAlertDone(alert.id, { done: alert.done, dueDate: alert.dueDate, dueKm: alert.dueKm });
      if (!res.ok) { toast.error(res.error); return; }
      const next = res.data.next && dueText(res.data.next);
      if (next?.length) toast.success(`Próximo: ${next.join(" · ")}`);
      router.refresh();
    });
  }

  async function onDelete() {
    if (!(await confirm({ title: "Excluir este alerta?", description: alert.label }))) return;
    startTransition(async () => {
      const res = await deleteCustomAlert(alert.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Alerta excluído");
      router.refresh();
    });
  }

  const hints = dueText(alert);
  const toggleLabel = alert.done ? "Marcar como pendente" : rolls ? "Concluir e agendar o próximo" : "Marcar como concluído";

  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-border bg-surface p-3">
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        aria-pressed={rolls ? undefined : alert.done}
        aria-label={toggleLabel}
        title={rolls ? toggleLabel : undefined}
        className={cn(
          "flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border transition disabled:opacity-50",
          alert.done ? "border-accent bg-accent text-bg" : "border-border text-transparent hover:border-accent hover:text-accent/60",
        )}
      >
        <Check size={14} strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={alert.done ? "text-muted line-through" : "font-medium"}>{alert.label}</span>
          {!alert.done && alert.status && alert.status !== "ok" && <StatusBadge status={alert.status}>{alert.detail}</StatusBadge>}
          {repeat && (
            <span className="mono whitespace-nowrap text-[11px] text-muted">
              <span aria-hidden>↻ </span><span className="sr-only">repete: </span>{repeat}
            </span>
          )}
        </div>
        {hints.length > 0 && <div className="mono mt-0.5 text-xs text-muted">{hints.join(" · ")}</div>}
      </div>
      <div className="flex shrink-0">
        <CustomAlertForm vehicleId={vehicleId} alert={alert}
          trigger={<Button variant="ghost" size="icon" disabled={pending} aria-label="Editar alerta" title="Editar"><Pencil size={14} /></Button>} />
        <Button variant="danger" size="icon" onClick={onDelete} disabled={pending} aria-label="Excluir alerta" title="Excluir"><Trash2 size={14} /></Button>
      </div>
      {confirmDialog}
    </div>
  );
}

export function CustomAlertList({ vehicleId, alerts }: { vehicleId: string; alerts: CustomAlertRecord[] }) {
  if (!alerts.length) return <p className="mono text-xs text-muted">{"// nenhum alerta: use para IPVA, licenciamento, seguro ou o que não está na ficha"}</p>;
  return (
    <div className="grid gap-2">
      {alerts.map((a) => <AlertItem key={a.id} alert={a} vehicleId={vehicleId} />)}
    </div>
  );
}
