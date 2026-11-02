"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { UpgradeCategory } from "@prisma/client";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteUpgrade } from "@/actions/upgrades";
import { AnimatedCard } from "@/components/common/AnimatedCard";
import { CategoryBadge } from "@/components/common/CategoryBadge";
import { Thumb } from "@/components/gallery/Thumb";
import { Money } from "@/components/common/Money";
import { UpgradeForm } from "./UpgradeForm";
import { UPGRADE_LABELS } from "@/lib/categories";
import { UPGRADE_ICONS } from "@/lib/category-icons";
import { formatDateOnly } from "@/lib/dates";
import { useUi } from "@/store/ui";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";

type Att = { id: string; kind: "image" | "pdf"; url: string; fileName: string; caption?: string | null };
export type Serialized = {
  id: string;
  date: string;
  name: string;
  category: UpgradeCategory;
  costCents: number;
  supplier: string | null;
  notes: string | null;
  attachments: Att[];
};

function UpgradeNode({ u, i, vehicleId }: { u: Serialized; i: number; vehicleId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  const images = u.attachments.filter((a) => a.kind === "image");
  const lightboxImages = images.map((a) => ({ url: a.url, caption: a.caption }));
  const dateLabel = formatDateOnly(u.date, "dd MMM yyyy").toUpperCase();

  async function onDelete() {
    if (!(await confirm({ title: "Excluir este upgrade?", description: `${u.name}. Os anexos também serão apagados.` }))) return;
    startTransition(async () => {
      const res = await deleteUpgrade(u.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Upgrade excluído");
      router.refresh();
    });
  }

  return (
    <AnimatedCard i={i} className="relative pl-8">
      <span className="absolute left-[5px] top-5 h-3 w-3 rounded-full border-2 border-bg bg-accent" />
      <div className="grid grid-cols-[1fr_auto] items-start gap-3 rounded-[10px] border border-border bg-surface p-4">
        <div className="min-w-0">
          <div className="tabular-nums text-xs text-muted">{dateLabel}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="font-bold">{u.name}</span>
            <CategoryBadge icon={UPGRADE_ICONS[u.category]} label={UPGRADE_LABELS[u.category]} />
          </div>
          {u.supplier && <div className="tabular-nums mt-0.5 text-xs text-muted">{u.supplier}</div>}
          {u.notes && <p className="mt-1 text-xs text-muted">{u.notes}</p>}
          {images.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {images.map((a, idx) => (
                <Thumb
                  key={a.id}
                  src={a.url}
                  label={a.caption ?? a.fileName}
                  onClick={() => useUi.getState().openLightbox(lightboxImages, idx)}
                  className="h-14 w-14 rounded-md hover:border-accent"
                />
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Money cents={u.costCents} className="tabular-nums font-bold text-accent" />
          <div className="-mr-1.5 flex">
            <UpgradeForm vehicleId={vehicleId} upgrade={u}
              trigger={<Button variant="ghost" size="icon" disabled={pending} aria-label="Editar upgrade" title="Editar"><Pencil size={14} /></Button>} />
            <Button variant="danger" size="icon" onClick={onDelete} disabled={pending} aria-label="Excluir upgrade" title="Excluir"><Trash2 size={14} /></Button>
          </div>
        </div>
      </div>
      {confirmDialog}
    </AnimatedCard>
  );
}

export function UpgradeTimeline({ vehicleId, upgrades }: { vehicleId: string; upgrades: Serialized[] }) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <UpgradeForm vehicleId={vehicleId} trigger={<Button><Plus size={16} /> Upgrade</Button>} />
      </div>
      {upgrades.length === 0 ? (
        <p className="text-sm text-muted">Nenhum upgrade registrado</p>
      ) : (
        <div className="relative grid gap-4 before:absolute before:bottom-2 before:left-[10px] before:top-2 before:w-px before:bg-border">
          {upgrades.map((u, i) => <UpgradeNode key={u.id} u={u} i={i} vehicleId={vehicleId} />)}
        </div>
      )}
    </div>
  );
}
