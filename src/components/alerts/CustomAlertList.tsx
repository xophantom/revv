"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { toggleCustomAlertDone, deleteCustomAlert } from "@/actions/alerts";
import { formatDateOnly } from "@/lib/dates";

export type CustomAlertRecord = {
  id: string;
  label: string;
  dueKm: number | null;
  dueDate: string | null;
  done: boolean;
};

function AlertItem({ alert }: { alert: CustomAlertRecord }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onToggle() {
    startTransition(async () => {
      const res = await toggleCustomAlertDone(alert.id);
      if (!res.ok) { toast.error(res.error); return; }
      router.refresh();
    });
  }

  function onDelete() {
    if (!window.confirm("Excluir este alerta?")) return;
    startTransition(async () => {
      const res = await deleteCustomAlert(alert.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Alerta excluído");
      router.refresh();
    });
  }

  const hints: string[] = [];
  if (alert.dueKm != null) hints.push(`${alert.dueKm.toLocaleString("pt-BR")} km`);
  if (alert.dueDate) hints.push(formatDateOnly(alert.dueDate, "dd/MM/yyyy"));

  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-border bg-surface p-3">
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        aria-label={alert.done ? "Marcar como pendente" : "Marcar como concluído"}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition disabled:opacity-50 ${alert.done ? "border-accent bg-accent text-bg" : "border-border text-transparent hover:border-accent"}`}
      >
        ✓
      </button>
      <div className="min-w-0 flex-1">
        <span className={alert.done ? "text-muted line-through" : "font-medium"}>{alert.label}</span>
        {hints.length > 0 && (
          <div className="mono mt-0.5 text-xs text-muted">{hints.join(" · ")}</div>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        aria-label="Excluir alerta"
        className="mono shrink-0 text-sm text-muted transition hover:text-accent disabled:opacity-50"
      >
        ✕
      </button>
    </div>
  );
}

export function CustomAlertList({ alerts }: { alerts: CustomAlertRecord[] }) {
  if (!alerts.length) return null;
  return (
    <div className="mt-3 grid gap-2">
      {alerts.map((a) => <AlertItem key={a.id} alert={a} />)}
    </div>
  );
}
