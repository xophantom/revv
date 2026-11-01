"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createMaintenance } from "@/actions/maintenance";
import { AttachmentUploader, UploadedFiles, type Uploaded } from "@/components/common/AttachmentUploader";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAINTENANCE_CATEGORIES, MAINTENANCE_LABELS } from "@/lib/categories";
import { realToCents } from "@/lib/money";
import { todayInputValue } from "@/lib/dates";

const selectClass = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent";

export function MaintenanceForm({ vehicleId, specRules, currentKm }: { vehicleId: string; specRules: { id: string; label: string }[]; currentKm: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [attachments, setAttachments] = useState<Uploaded[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);
  const today = todayInputValue();

  function reset() { setAttachments([]); setUploading(false); }
  // Esc/outside click can't close the dialog mid-save; the save's completion closes it.
  function onOpenChange(next: boolean) {
    if (!next && pending) return;
    setOpen(next);
    if (!next) reset();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || uploading) return;
    const fd = new FormData(e.currentTarget);
    const cost = String(fd.get("cost") ?? "");
    const specRuleId = String(fd.get("specRuleId") ?? "");
    const payload = {
      date: String(fd.get("date") ?? ""),
      km: String(fd.get("km") ?? ""),
      category: String(fd.get("category") ?? ""),
      specRuleId: specRuleId || undefined,
      title: String(fd.get("title") ?? ""),
      workshop: String(fd.get("workshop") ?? ""),
      costCents: realToCents(cost || "0"),
      notes: String(fd.get("notes") ?? ""),
      attachments,
    };
    setPending(true);
    try {
      const res = await createMaintenance(vehicleId, payload);
      if (!res.ok) { toast.error(res.error); return; }
      const km = res.data.odometerUpdatedTo;
      toast.success(km != null ? `Manutenção registrada · odômetro atualizado para ${km.toLocaleString("pt-BR")} km` : "Manutenção registrada");
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild><Button className="bg-accent text-bg">+ Manutenção</Button></DialogTrigger>
      <DialogContent className="glass">
        <DialogHeader><DialogTitle>Nova manutenção</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data</Label><Input name="date" type="date" defaultValue={today} required /></div>
            <div><Label>Km</Label><Input name="km" type="number" inputMode="numeric" placeholder={`atual: ${currentKm.toLocaleString("pt-BR")}`} required /></div>
          </div>
          <div><Label>Categoria</Label>
            <select name="category" className={selectClass} defaultValue={MAINTENANCE_CATEGORIES[0]}>
              {MAINTENANCE_CATEGORIES.map((c) => <option key={c} value={c}>{MAINTENANCE_LABELS[c]}</option>)}
            </select>
          </div>
          {specRules.length > 0 && (
            <div><Label>Referente a (opcional)</Label>
              <select name="specRuleId" className={selectClass} defaultValue="">
                <option value="">—</option>
                {specRules.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
          )}
          <div><Label>Título</Label><Input name="title" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Oficina</Label><Input name="workshop" /></div>
            <div><Label>Custo</Label><Input name="cost" type="text" inputMode="decimal" placeholder="0,00" /></div>
          </div>
          <div><Label>Notas</Label><Textarea name="notes" /></div>
          <div>
            <AttachmentUploader disabled={pending} onBusyChange={setUploading}
              onUploaded={(f) => setAttachments((prev) => [...prev, ...f])} />
            <UploadedFiles files={attachments} disabled={pending}
              onRemove={(f) => setAttachments((prev) => prev.filter((a) => a.key !== f.key))} />
          </div>
          <Button type="submit" disabled={pending || uploading} className="bg-accent text-bg">
            {pending ? "Salvando..." : uploading ? "Aguardando upload..." : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
