"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { UpgradeCategory } from "@prisma/client";
import { deleteUpgrade } from "@/actions/upgrades";
import { AnimatedCard } from "@/components/common/AnimatedCard";
import { Money } from "@/components/common/Money";
import { UpgradeForm } from "./UpgradeForm";
import { UPGRADE_LABELS } from "@/lib/categories";
import { formatDateOnly } from "@/lib/dates";
import { useUi } from "@/store/ui";

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

function UpgradeNode({ u, i }: { u: Serialized; i: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const images = u.attachments.filter((a) => a.kind === "image");
  const lightboxImages = images.map((a) => ({ url: a.url, caption: a.caption }));
  const dateLabel = formatDateOnly(u.date, "dd MMM yyyy").toUpperCase();

  function onDelete() {
    if (!window.confirm("Excluir este upgrade?")) return;
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
          <div className="mono text-xs text-muted">{dateLabel}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="font-bold">{u.name}</span>
            <span className="mono rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">{UPGRADE_LABELS[u.category]}</span>
          </div>
          {u.supplier && <div className="mono mt-0.5 text-xs text-muted">{u.supplier}</div>}
          {u.notes && <p className="mt-1 text-xs text-muted">{u.notes}</p>}
          {images.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {images.map((a, idx) => (
                <button
                  key={a.id}
                  type="button"
                  aria-label={a.caption ?? a.fileName}
                  onClick={() => useUi.getState().openLightbox(lightboxImages, idx)}
                  className="h-14 w-14 rounded-md border border-border bg-surface2 bg-cover bg-center transition hover:border-accent"
                  style={{ backgroundImage: `url(${a.url})` }}
                />
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Money cents={u.costCents} className="mono font-bold text-accent" />
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
    </AnimatedCard>
  );
}

export function UpgradeTimeline({ vehicleId, upgrades }: { vehicleId: string; upgrades: Serialized[] }) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <UpgradeForm vehicleId={vehicleId} />
      </div>
      {upgrades.length === 0 ? (
        <p className="mono text-sm text-muted">// nenhum upgrade registrado</p>
      ) : (
        <div className="relative grid gap-4 before:absolute before:bottom-2 before:left-[10px] before:top-2 before:w-px before:bg-border">
          {upgrades.map((u, i) => <UpgradeNode key={u.id} u={u} i={i} />)}
        </div>
      )}
    </div>
  );
}
