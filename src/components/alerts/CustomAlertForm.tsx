"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCustomAlert } from "@/actions/alerts";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CustomAlertForm({ vehicleId }: { vehicleId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    const dueKm = String(fd.get("dueKm") ?? "");
    const dueDate = String(fd.get("dueDate") ?? "");
    const payload = {
      label: String(fd.get("label") ?? ""),
      dueKm: dueKm ? Number(dueKm) : undefined,
      dueDate: dueDate || undefined,
    };
    setPending(true);
    try {
      const res = await createCustomAlert(vehicleId, payload);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Alerta criado");
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next || !pending) && setOpen(next)}>
      <DialogTrigger asChild>
        <Button className="border border-border text-muted">+ alerta</Button>
      </DialogTrigger>
      <DialogContent className="glass">
        <DialogHeader><DialogTitle>Novo alerta</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3">
          <div><Label>Descrição</Label><Input name="label" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Km (opcional)</Label><Input name="dueKm" type="number" inputMode="numeric" /></div>
            <div><Label>Data (opcional)</Label><Input name="dueDate" type="date" /></div>
          </div>
          <p className="mono text-[11px] text-muted">Informe pelo menos km ou data.</p>
          <Button type="submit" disabled={pending} className="bg-accent text-bg">{pending ? "Salvando..." : "Salvar"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
