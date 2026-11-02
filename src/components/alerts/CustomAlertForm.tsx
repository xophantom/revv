"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCustomAlert, updateCustomAlert } from "@/actions/alerts";
import { FormDialog, type FormDialogApi } from "@/components/common/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CustomAlertRecord } from "./CustomAlertList";

export function CustomAlertForm({ vehicleId, alert, trigger }: { vehicleId: string; alert?: CustomAlertRecord; trigger?: React.ReactNode }) {
  return (
    <FormDialog title={alert ? "Editar alerta" : "Novo alerta"} trigger={trigger ?? <Button className="border border-border text-muted">+ alerta</Button>}>
      {(api) => <CustomAlertFields vehicleId={vehicleId} alert={alert} {...api} />}
    </FormDialog>
  );
}

function CustomAlertFields({ vehicleId, alert, close, setBusy }: { vehicleId: string; alert?: CustomAlertRecord } & FormDialogApi) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    const dueKm = String(fd.get("dueKm") ?? "");
    const dueDate = String(fd.get("dueDate") ?? "");
    // null (not undefined) so editing can clear one of the two
    const payload = {
      label: String(fd.get("label") ?? ""),
      dueKm: dueKm ? Number(dueKm) : null,
      dueDate: dueDate || null,
    };
    setPending(true);
    setBusy(true);
    try {
      const res = alert ? await updateCustomAlert(alert.id, payload) : await createCustomAlert(vehicleId, payload);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(alert ? "Alerta atualizado" : "Alerta criado");
      close();
      router.refresh();
    } finally {
      setPending(false);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div><Label>Descrição</Label><Input name="label" required defaultValue={alert?.label} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Km (opcional)</Label><Input name="dueKm" type="number" inputMode="numeric" defaultValue={alert?.dueKm ?? ""} /></div>
        <div><Label>Data (opcional)</Label><Input name="dueDate" type="date" defaultValue={alert?.dueDate?.slice(0, 10) ?? ""} /></div>
      </div>
      <p className="mono text-[11px] text-muted">Informe pelo menos km ou data.</p>
      <Button type="submit" disabled={pending} className="bg-accent text-bg">{pending ? "Salvando..." : "Salvar"}</Button>
    </form>
  );
}
