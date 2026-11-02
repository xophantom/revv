"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { UpgradeCategory } from "@prisma/client";
import { createUpgrade, updateUpgrade } from "@/actions/upgrades";
import { AttachmentUploader, UploadedFiles, type Uploaded } from "@/components/common/AttachmentUploader";
import { FormDialog, type FormDialogApi } from "@/components/common/FormDialog";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/masked-input";
import { Textarea } from "@/components/ui/textarea";
import { UPGRADE_CATEGORIES, UPGRADE_LABELS } from "@/lib/categories";
import { UPGRADE_ICONS } from "@/lib/category-icons";
import { realToCents } from "@/lib/money";
import { todayInputValue } from "@/lib/dates";
import type { Serialized } from "./UpgradeTimeline";

export function UpgradeForm({ vehicleId, upgrade, trigger }: { vehicleId: string; upgrade?: Serialized; trigger: React.ReactNode }) {
  return (
    <FormDialog title={upgrade ? "Editar upgrade" : "Novo upgrade"} trigger={trigger}>
      {(api) => <UpgradeFields vehicleId={vehicleId} upgrade={upgrade} {...api} />}
    </FormDialog>
  );
}

function UpgradeFields({ vehicleId, upgrade, close, setBusy }: { vehicleId: string; upgrade?: Serialized } & FormDialogApi) {
  const router = useRouter();
  const [category, setCategory] = useState<UpgradeCategory>(upgrade?.category ?? UPGRADE_CATEGORIES[0]);
  const [kept, setKept] = useState(upgrade?.attachments ?? []);
  const [attachments, setAttachments] = useState<Uploaded[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || uploading) return;
    const fd = new FormData(e.currentTarget);
    const cost = String(fd.get("cost") ?? "");
    const payload = {
      date: String(fd.get("date") ?? ""),
      name: String(fd.get("name") ?? ""),
      category,
      costCents: realToCents(cost || "0"),
      supplier: String(fd.get("supplier") ?? ""),
      notes: String(fd.get("notes") ?? ""),
      attachments,
      removeAttachmentIds: upgrade ? upgrade.attachments.filter((a) => !kept.some((k) => k.id === a.id)).map((a) => a.id) : [],
    };
    setPending(true);
    setBusy(true);
    try {
      const res = upgrade ? await updateUpgrade(upgrade.id, payload) : await createUpgrade(vehicleId, payload);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(upgrade ? "Upgrade atualizado" : "Upgrade registrado");
      close();
      router.refresh();
    } finally {
      setPending(false);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <Field label="Data" className="max-w-[calc(50%-0.375rem)]"><Input name="date" type="date" defaultValue={upgrade ? upgrade.date.slice(0, 10) : todayInputValue()} required /></Field>
      <Field label="Categoria" group>
        <div className="flex flex-wrap gap-1.5">
          {UPGRADE_CATEGORIES.map((c) => (
            <Chip key={c} icon={UPGRADE_ICONS[c]} selected={c === category} disabled={pending} onClick={() => setCategory(c)}>{UPGRADE_LABELS[c]}</Chip>
          ))}
        </div>
      </Field>
      <Field label="Nome"><Input name="name" required defaultValue={upgrade?.name} placeholder="Ex.: Escape inox" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fornecedor"><Input name="supplier" defaultValue={upgrade?.supplier ?? ""} /></Field>
        <Field label="Custo"><MoneyInput name="cost" defaultCents={upgrade?.costCents} /></Field>
      </div>
      <Field label="Notas"><Textarea name="notes" defaultValue={upgrade?.notes ?? ""} /></Field>
      <div>
        <AttachmentUploader label="Fotos antes/depois, peça, instalada" disabled={pending} onBusyChange={setUploading}
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
