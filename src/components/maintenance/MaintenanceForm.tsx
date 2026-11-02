"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { MaintenanceCategory } from "@prisma/client";
import { Check } from "lucide-react";
import { createMaintenance, updateMaintenance } from "@/actions/maintenance";
import type { SpecRuleOption } from "@/domain/alerts";
import { AttachmentUploader, UploadedFiles, type Uploaded } from "@/components/common/AttachmentUploader";
import { FormDialog, type FormDialogApi } from "@/components/common/FormDialog";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { IntegerInput, MoneyInput } from "@/components/ui/masked-input";
import { Textarea } from "@/components/ui/textarea";
import { MAINTENANCE_CATEGORIES, MAINTENANCE_LABELS } from "@/lib/categories";
import { MAINTENANCE_ICONS } from "@/lib/category-icons";
import { realToCents } from "@/lib/money";
import { todayInputValue } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { MaintRecord } from "./MaintenanceRow";

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
        <Field label="Data"><Input name="date" type="date" defaultValue={record ? record.date.slice(0, 10) : todayInputValue()} required /></Field>
        <Field label="Km"><IntegerInput name="km" suffix="km" required defaultValue={record?.km ?? draft?.km} placeholder={`atual: ${currentKm.toLocaleString("pt-BR")}`} /></Field>
      </div>
      <Field label="Categoria" group>
        <div className="flex flex-wrap gap-1.5">
          {MAINTENANCE_CATEGORIES.map((c) => (
            <Chip key={c} icon={MAINTENANCE_ICONS[c]} selected={c === category} disabled={pending} onClick={() => changeCategory(c)}>
              {MAINTENANCE_LABELS[c]}
            </Chip>
          ))}
        </div>
      </Field>
      {specRules.length > 0 && (
        <Field label="Itens feitos" group hint={
          <span className={cn(needsItem && "text-accent")}>
            {needsItem ? "Marque o que foi feito, senão este registro não atualiza nenhum alerta." : "Os itens marcados zeram os alertas da ficha."}
          </span>
        }>
          <div className="flex flex-wrap gap-1.5">
            {specRules.map((r) => (
              <Chip key={r.id} selected={items.includes(r.id)} disabled={pending} onClick={() => toggle(r.id)}>
                {items.includes(r.id) && <Check size={12} aria-hidden />}{r.label}
              </Chip>
            ))}
          </div>
        </Field>
      )}
      <Field label="Título"><Input name="title" required defaultValue={record?.title ?? draft?.title} placeholder="Ex.: Troca de óleo e filtro" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Oficina"><Input name="workshop" defaultValue={record?.workshop ?? ""} /></Field>
        <Field label="Custo"><MoneyInput name="cost" defaultCents={record?.costCents} /></Field>
      </div>
      <Field label="Notas"><Textarea name="notes" defaultValue={record?.notes ?? ""} /></Field>
      <div>
        <AttachmentUploader disabled={pending} onBusyChange={setUploading}
          onUploaded={(f) => setAttachments((prev) => [...prev, ...f])} />
        <UploadedFiles files={kept.map((a) => ({ key: a.id, fileName: a.fileName }))} disabled={pending}
          onRemove={(f) => setKept((prev) => prev.filter((a) => a.id !== f.key))} />
        <UploadedFiles files={attachments} disabled={pending}
          onRemove={(f) => setAttachments((prev) => prev.filter((a) => a.key !== f.key))} />
      </div>
      <Button type="submit" disabled={pending || uploading}>
        {pending ? "Salvando..." : uploading ? "Aguardando upload..." : "Salvar"}
      </Button>
    </form>
  );
}
