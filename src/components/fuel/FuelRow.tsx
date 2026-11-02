"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { FuelType } from "@prisma/client";
import { Pencil, Trash2 } from "lucide-react";
import { deleteFuelRecord } from "@/actions/fuel";
import { CategoryBadge } from "@/components/common/CategoryBadge";
import { Money } from "@/components/common/Money";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { formatKmPerLiter, formatLiters, litersOf } from "@/domain/fuel";
import { FUEL_LABELS } from "@/lib/categories";
import { FUEL_ICON } from "@/lib/category-icons";
import { formatDateOnly } from "@/lib/dates";
import { centsToBRL } from "@/lib/money";
import { FuelForm, type FuelFormProps } from "./FuelForm";

export type FuelRecordView = {
  id: string;
  date: string;
  km: number;
  volumeMl: number;
  costCents: number;
  fuel: FuelType;
  fullTank: boolean;
  station: string | null;
  notes: string | null;
  pricePerLiterCents: number | null;
  kmPerLiter: number | null; // this fill's reading, when it closes a span
  spanKm: number | null;
};

export function FuelRow({ record, form }: { record: FuelRecordView; form: FuelFormProps }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  const day = formatDateOnly(record.date, "dd");
  const month = formatDateOnly(record.date, "MMM").toUpperCase();
  const year = formatDateOnly(record.date, "yyyy");
  const liters = formatLiters(litersOf(record.volumeMl));
  const details = [
    record.pricePerLiterCents != null && `${centsToBRL(record.pricePerLiterCents)}/L`,
    `${record.km.toLocaleString("pt-BR")} km`,
    record.station,
  ].filter(Boolean).join(" · ");

  async function onDelete() {
    const description = `${liters} em ${formatDateOnly(record.date, "dd/MM/yyyy")}. O consumo dos abastecimentos vizinhos é recalculado.`;
    if (!(await confirm({ title: "Excluir este abastecimento?", description }))) return;
    startTransition(async () => {
      const res = await deleteFuelRecord(record.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Abastecimento excluído");
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
          <span className="mono font-medium tabular-nums">{liters}</span>
          <CategoryBadge icon={FUEL_ICON} label={FUEL_LABELS[record.fuel]} />
          {!record.fullTank && <span className="mono rounded border border-dashed border-white/20 px-1.5 py-0.5 text-[11px] text-muted">parcial</span>}
          {record.kmPerLiter != null && (
            <span className="mono rounded border border-accent/50 bg-accent/10 px-1.5 py-0.5 text-[11px] text-accent tabular-nums"
              title={record.spanKm != null ? `${record.spanKm.toLocaleString("pt-BR")} km desde o tanque cheio anterior` : undefined}>
              {formatKmPerLiter(record.kmPerLiter)}
            </span>
          )}
        </div>
        <div className="mono mt-0.5 break-words text-xs text-muted">{details}</div>
        {record.notes && <p className="mt-1 text-xs text-muted">{record.notes}</p>}
      </div>
      <div className="flex flex-col items-end gap-1">
        <Money cents={record.costCents} className="mono font-bold text-accent" />
        <div className="-mr-1.5 flex">
          <FuelForm {...form} record={record}
            trigger={<Button variant="ghost" size="icon" disabled={pending} aria-label="Editar abastecimento" title="Editar"><Pencil size={14} /></Button>} />
          <Button variant="danger" size="icon" onClick={onDelete} disabled={pending} aria-label="Excluir abastecimento" title="Excluir"><Trash2 size={14} /></Button>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}
