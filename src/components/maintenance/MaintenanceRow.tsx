"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { MaintenanceCategory } from "@prisma/client";
import { Pencil, Trash2 } from "lucide-react";
import { deleteMaintenance } from "@/actions/maintenance";
import { AttachmentList } from "@/components/common/AttachmentList";
import { CategoryBadge } from "@/components/common/CategoryBadge";
import { Money } from "@/components/common/Money";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { MAINTENANCE_LABELS } from "@/lib/categories";
import { MAINTENANCE_ICONS } from "@/lib/category-icons";
import { formatDateOnly } from "@/lib/dates";
import { MaintenanceForm, type MaintenanceFormProps } from "./MaintenanceForm";

type Att = { id: string; kind: "image" | "pdf"; url: string; fileName: string; caption?: string | null };
export type MaintRecord = {
  id: string;
  date: string;
  km: number;
  category: MaintenanceCategory;
  specRuleIds: string[];
  title: string;
  workshop: string | null;
  costCents: number;
  notes: string | null;
  attachments: Att[];
};

export function MaintenanceRow({ record, form }: { record: MaintRecord; form: MaintenanceFormProps }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  const day = formatDateOnly(record.date, "dd");
  const month = formatDateOnly(record.date, "MMM").toUpperCase();
  const year = formatDateOnly(record.date, "yyyy");
  const items = record.specRuleIds.flatMap((id) => form.specRules.find((r) => r.id === id)?.label ?? []);

  async function onDelete() {
    if (!(await confirm({ title: "Excluir esta manutenção?", description: `${record.title}. Os anexos também serão apagados.` }))) return;
    startTransition(async () => {
      const res = await deleteMaintenance(record.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Manutenção excluída");
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-[10px] border border-border bg-surface p-3">
      <div className="mono flex flex-col items-center justify-center rounded-md bg-surface2 px-2 py-1.5 text-center leading-tight">
        <span className="text-lg font-bold">{day}</span>
        <span className="text-[11px] text-muted">{month}</span>
        <span className="text-[11px] text-muted">{year}</span>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{record.title}</span>
          <CategoryBadge icon={MAINTENANCE_ICONS[record.category]} label={MAINTENANCE_LABELS[record.category]} />
          {items.length > 0 && <span className="mono text-[11px] text-muted">{items.join(" · ")}</span>}
        </div>
        <div className="mono mt-0.5 text-xs text-muted">
          {record.workshop ? record.workshop + " · " : ""}{record.km.toLocaleString("pt-BR")} km
        </div>
        {record.notes && <p className="mt-1 text-xs text-muted">{record.notes}</p>}
        {record.attachments.length > 0 && <div className="mt-2"><AttachmentList attachments={record.attachments} /></div>}
      </div>
      <div className="flex flex-col items-end gap-1">
        <Money cents={record.costCents} className="mono font-bold text-accent" />
        <div className="-mr-1.5 flex">
          <MaintenanceForm {...form} record={record}
            trigger={<Button variant="ghost" size="icon" disabled={pending} aria-label="Editar manutenção" title="Editar"><Pencil size={14} /></Button>} />
          <Button variant="danger" size="icon" onClick={onDelete} disabled={pending} aria-label="Excluir manutenção" title="Excluir"><Trash2 size={14} /></Button>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}
