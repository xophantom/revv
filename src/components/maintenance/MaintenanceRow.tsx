"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { MaintenanceCategory } from "@prisma/client";
import { deleteMaintenance } from "@/actions/maintenance";
import { AttachmentList } from "@/components/common/AttachmentList";
import { Money } from "@/components/common/Money";
import { MAINTENANCE_LABELS } from "@/lib/categories";
import { formatDateOnly } from "@/lib/dates";

type Att = { id: string; kind: "image" | "pdf"; url: string; fileName: string; caption?: string | null };
export type MaintRecord = {
  id: string;
  date: string;
  km: number;
  category: MaintenanceCategory;
  title: string;
  workshop: string | null;
  costCents: number;
  notes: string | null;
  attachments: Att[];
};

export function MaintenanceRow({ record }: { record: MaintRecord }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const day = formatDateOnly(record.date, "dd");
  const month = formatDateOnly(record.date, "MMM").toUpperCase();
  const year = formatDateOnly(record.date, "yyyy");

  function onDelete() {
    if (!window.confirm("Excluir esta manutenção?")) return;
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
        <span className="text-[10px] text-muted">{month}</span>
        <span className="text-[10px] text-muted">{year}</span>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{record.title}</span>
          <span className="mono rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">{MAINTENANCE_LABELS[record.category]}</span>
        </div>
        <div className="mono mt-0.5 text-xs text-muted">
          {record.workshop ? record.workshop + " · " : ""}{record.km.toLocaleString("pt-BR")} km
        </div>
        {record.notes && <p className="mt-1 text-xs text-muted">{record.notes}</p>}
        {record.attachments.length > 0 && <div className="mt-2"><AttachmentList attachments={record.attachments} /></div>}
      </div>
      <div className="flex flex-col items-end gap-2">
        <Money cents={record.costCents} className="mono font-bold text-accent" />
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="mono text-[10px] text-muted transition hover:text-accent disabled:opacity-50"
        >
          excluir
        </button>
      </div>
    </div>
  );
}
