"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createUpgrade, updateUpgrade } from "@/actions/upgrades";
import { AttachmentUploader, UploadedFiles, type Uploaded } from "@/components/common/AttachmentUploader";
import { FormDialog, type FormDialogApi } from "@/components/common/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UPGRADE_CATEGORIES, UPGRADE_LABELS } from "@/lib/categories";
import { centsToInput, realToCents } from "@/lib/money";
import { todayInputValue } from "@/lib/dates";
import type { Serialized } from "./UpgradeTimeline";

const selectClass = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent";

export function UpgradeForm({ vehicleId, upgrade, trigger }: { vehicleId: string; upgrade?: Serialized; trigger: React.ReactNode }) {
  return (
    <FormDialog title={upgrade ? "Editar upgrade" : "Novo upgrade"} trigger={trigger}>
      {(api) => <UpgradeFields vehicleId={vehicleId} upgrade={upgrade} {...api} />}
    </FormDialog>
  );
}

function UpgradeFields({ vehicleId, upgrade, close, setBusy }: { vehicleId: string; upgrade?: Serialized } & FormDialogApi) {
  const router = useRouter();
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
      category: String(fd.get("category") ?? ""),
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
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Data</Label><Input name="date" type="date" defaultValue={upgrade ? upgrade.date.slice(0, 10) : todayInputValue()} required /></div>
        <div><Label>Categoria</Label>
          <select name="category" className={selectClass} defaultValue={upgrade?.category ?? UPGRADE_CATEGORIES[0]}>
            {UPGRADE_CATEGORIES.map((c) => <option key={c} value={c}>{UPGRADE_LABELS[c]}</option>)}
          </select>
        </div>
      </div>
      <div><Label>Nome</Label><Input name="name" required defaultValue={upgrade?.name} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Fornecedor</Label><Input name="supplier" defaultValue={upgrade?.supplier ?? ""} /></div>
        <div><Label>Custo</Label><Input name="cost" type="text" inputMode="decimal" placeholder="0,00" defaultValue={upgrade ? centsToInput(upgrade.costCents) : ""} /></div>
      </div>
      <div><Label>Notas</Label><Textarea name="notes" defaultValue={upgrade?.notes ?? ""} /></div>
      <div>
        <AttachmentUploader label="Fotos antes/depois, peça, instalada" disabled={pending} onBusyChange={setUploading}
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
