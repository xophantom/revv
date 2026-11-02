"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { MaintenanceCategory } from "@prisma/client";
import { createMaintenance, updateMaintenance } from "@/actions/maintenance";
import type { SpecRuleOption } from "@/domain/alerts";
import { AttachmentUploader, UploadedFiles, type Uploaded } from "@/components/common/AttachmentUploader";
import { FormDialog, type FormDialogApi } from "@/components/common/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAINTENANCE_CATEGORIES, MAINTENANCE_LABELS } from "@/lib/categories";
import { centsToInput, realToCents } from "@/lib/money";
import { todayInputValue } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { MaintRecord } from "./MaintenanceRow";

const selectClass = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent";

// Prefill for a new record, e.g. from an alert chip.
export type MaintDraft = { category: MaintenanceCategory; specRuleIds: string[]; title: string; km: number };

export type MaintenanceFormProps = { vehicleId: string; specRules: SpecRuleOption[]; currentKm: number };

export function MaintenanceForm({ record, draft, trigger, open, onOpenChange, ...props }: MaintenanceFormProps & {
  record?: MaintRecord;
  draft?: MaintDraft;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <FormDialog title={record ? "Editar manutenção" : "Nova manutenção"} trigger={trigger} open={open} onOpenChange={onOpenChange}>
      {(api) => <MaintenanceFields {...props} record={record} draft={draft} {...api} />}
    </FormDialog>
  );
}

function MaintenanceFields({ vehicleId, specRules, currentKm, record, draft, close, setBusy }: MaintenanceFormProps & FormDialogApi & {
  record?: MaintRecord;
  draft?: MaintDraft;
}) {
  const router = useRouter();
  // Oil and tires: picking the category ticks its item, so "Óleo + filtro de ar" still resets the oil
  // alert. A tick added this way follows the category (switching away drops it) until the user
  // toggles it, which makes it theirs.
  const tickFor = (c: MaintenanceCategory) => specRules.find((r) => r.category === c && r.byCategory)?.id ?? null;
  const initialCategory = record?.category ?? draft?.category ?? MAINTENANCE_CATEGORIES[0];
  const initialAuto = record || draft ? null : tickFor(initialCategory);
  const [category, setCategory] = useState<MaintenanceCategory>(initialCategory);
  const [items, setItems] = useState<string[]>(record?.specRuleIds ?? draft?.specRuleIds ?? (initialAuto ? [initialAuto] : []));
  const [auto, setAuto] = useState<string | null>(initialAuto);
  const [kept, setKept] = useState(record?.attachments ?? []);
  const [attachments, setAttachments] = useState<Uploaded[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);
  // Shared categories (filters, fluids, revision...) only reach an alert through a checked item.
  const needsItem = !items.length && specRules.some((r) => r.category === category && !r.byCategory);

  function toggle(id: string) {
    if (id === auto) setAuto(null);
    setItems((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function changeCategory(next: MaintenanceCategory) {
    const base = auto ? items.filter((x) => x !== auto) : items;
    const tick = tickFor(next);
    const added = tick && !base.includes(tick) ? tick : null;
    setCategory(next);
    setItems(added ? [...base, added] : base);
    setAuto(added);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || uploading) return;
    const fd = new FormData(e.currentTarget);
    const cost = String(fd.get("cost") ?? "");
    const payload = {
      date: String(fd.get("date") ?? ""),
      km: String(fd.get("km") ?? ""),
      category,
      specRuleIds: items,
      title: String(fd.get("title") ?? ""),
      workshop: String(fd.get("workshop") ?? ""),
      costCents: realToCents(cost || "0"),
      notes: String(fd.get("notes") ?? ""),
      attachments,
      removeAttachmentIds: record ? record.attachments.filter((a) => !kept.some((k) => k.id === a.id)).map((a) => a.id) : [],
    };
    setPending(true);
    setBusy(true);
    try {
      const res = record ? await updateMaintenance(record.id, payload) : await createMaintenance(vehicleId, payload);
      if (!res.ok) { toast.error(res.error); return; }
      const km = res.data.odometerUpdatedTo;
      const done = record ? "Manutenção atualizada" : "Manutenção registrada";
      toast.success(km != null ? `${done} · odômetro atualizado para ${km.toLocaleString("pt-BR")} km` : done);
      close();
      router.refresh();
    } finally {
      setPending(false);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Data</Label><Input name="date" type="date" defaultValue={record ? record.date.slice(0, 10) : todayInputValue()} required /></div>
        <div><Label>Km</Label><Input name="km" type="number" inputMode="numeric" defaultValue={record?.km ?? draft?.km} placeholder={`atual: ${currentKm.toLocaleString("pt-BR")}`} required /></div>
      </div>
      <div><Label>Categoria</Label>
        <select name="category" className={selectClass} value={category} onChange={(e) => changeCategory(e.target.value as MaintenanceCategory)}>
          {MAINTENANCE_CATEGORIES.map((c) => <option key={c} value={c}>{MAINTENANCE_LABELS[c]}</option>)}
        </select>
      </div>
      {specRules.length > 0 && (
        <div>
          <Label>Itens feitos</Label>
          <div className="flex flex-wrap gap-1.5">
            {specRules.map((r) => {
              const on = items.includes(r.id);
              return (
                <button key={r.id} type="button" aria-pressed={on} disabled={pending} onClick={() => toggle(r.id)}
                  className={cn("mono cursor-pointer rounded-md border px-2 py-1 text-[11px] transition disabled:opacity-50",
                    on ? "border-accent bg-accent/15 text-accent" : "border-border text-muted hover:text-fg")}>
                  {on ? "✓ " : ""}{r.label}
                </button>
              );
            })}
          </div>
          <p className={cn("mono mt-1 text-[11px]", needsItem ? "text-accent" : "text-muted")}>
            {needsItem ? "Marque o que foi feito, senão este registro não atualiza nenhum alerta." : "Os itens marcados zeram os alertas da ficha."}
          </p>
        </div>
      )}
      <div><Label>Título</Label><Input name="title" required defaultValue={record?.title ?? draft?.title} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Oficina</Label><Input name="workshop" defaultValue={record?.workshop ?? ""} /></div>
        <div><Label>Custo</Label><Input name="cost" type="text" inputMode="decimal" placeholder="0,00" defaultValue={record ? centsToInput(record.costCents) : ""} /></div>
      </div>
      <div><Label>Notas</Label><Textarea name="notes" defaultValue={record?.notes ?? ""} /></div>
      <div>
        <AttachmentUploader disabled={pending} onBusyChange={setUploading}
          onUploaded={(f) => setAttachments((prev) => [...prev, ...f])} />
        <UploadedFiles files={kept.map((a) => ({ key: a.id, fileName: a.fileName }))} disabled={pending}
          onRemove={(f) => setKept((prev) => prev.filter((a) => a.id !== f.key))} />
        <UploadedFiles files={attachments} disabled={pending}
          onRemove={(f) => setAttachments((prev) => prev.filter((a) => a.key !== f.key))} />
      </div>
      <Button type="submit" disabled={pending || uploading} className="bg-accent text-bg">
        {pending ? "Salvando..." : uploading ? "Aguardando upload..." : "Salvar"}
      </Button>
    </form>
  );
}
