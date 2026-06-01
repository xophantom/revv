"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createMaintenance } from "@/actions/maintenance";
import { AttachmentUploader, type Uploaded } from "@/components/common/AttachmentUploader";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAINTENANCE_CATEGORIES, MAINTENANCE_LABELS } from "@/lib/categories";
import { realToCents } from "@/lib/money";

const selectClass = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent";

export function MaintenanceForm({ vehicleId, specRules }: { vehicleId: string; specRules: { id: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [attachments, setAttachments] = useState<Uploaded[]>([]);
  const today = new Date().toISOString().slice(0, 10);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
    const res = await createMaintenance(vehicleId, payload);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Manutenção registrada");
    setOpen(false);
    setAttachments([]);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="bg-accent text-bg">+ Manutenção</Button></DialogTrigger>
      <DialogContent className="glass">
        <DialogHeader><DialogTitle>Nova manutenção</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data</Label><Input name="date" type="date" defaultValue={today} required /></div>
            <div><Label>Km</Label><Input name="km" type="number" required /></div>
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
            <div><Label>Custo</Label><Input name="cost" type="text" placeholder="0,00" /></div>
          </div>
          <div><Label>Notas</Label><Textarea name="notes" /></div>
          <div>
            <AttachmentUploader onUploaded={(f) => setAttachments((prev) => [...prev, ...f])} />
            {attachments.length > 0 && <p className="mono mt-1 text-xs text-muted">{attachments.length} arquivo(s) anexado(s)</p>}
          </div>
          <Button type="submit" className="bg-accent text-bg">Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
