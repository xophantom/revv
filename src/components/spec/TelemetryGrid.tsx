"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Pencil, Plus, StickyNote } from "lucide-react";
import type { AlertStatus } from "@/domain/alerts";
import type { Gauge, TelemetryItem } from "@/domain/telemetry";
import { MaintenanceForm, type MaintDraft, type MaintenanceFormProps } from "@/components/maintenance/MaintenanceForm";
import { Button, buttonClass } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { dueIn, formatKm, kmLeft, timeSpan } from "@/lib/alert-text";
import { formatDateOnly } from "@/lib/dates";
import { cn } from "@/lib/utils";

const SEGMENTS = 24;

// Rev-counter style bar: used share in segments, with the "soon" stretch tinted like a redline.
function GaugeBar({ gauge, status, label }: { gauge: Gauge | null; status: AlertStatus; label: string }) {
  const filled = gauge ? Math.round(gauge.fraction * SEGMENTS) : 0;
  const zone = gauge ? Math.floor(gauge.soonAt * SEGMENTS) : SEGMENTS;
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={gauge ? Math.round(gauge.fraction * 100) : 0}
      className="mt-3 flex h-2.5 gap-[2px]">
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span key={i} className={cn(
          "flex-1 rounded-[1px]",
          !gauge ? "border border-dashed border-white/10"
            : i < filled ? (status === "ok" ? "bg-fg/70" : "bg-accent")
              : i >= zone ? "bg-accent/20" : "bg-white/[.07]",
        )} />
      ))}
    </div>
  );
}

// `used` is clamped: an odometer set below the last service or a future service date would go negative.
function gaugeText(g: Gauge): { used: string; left: string } {
  const used = Math.max(0, g.total - g.remaining);
  if (g.dim === "km") return { used: `${used.toLocaleString("pt-BR")} / ${formatKm(g.total)}`, left: kmLeft(g.remaining) };
  return { used: used ? `há ${timeSpan(used)}` : "feita hoje", left: dueIn(g.remaining) };
}

function TelemetryCard({ item, onRegister }: { item: TelemetryItem; onRegister?: () => void }) {
  const { alert, gauge } = item;
  const text = gauge && gaugeText(gauge);
  const last = alert && [alert.lastDate && formatDateOnly(alert.lastDate, "dd/MM/yy"), alert.lastKm != null && formatKm(alert.lastKm)].filter(Boolean).join(" · ");
  return (
    <div className={cn("flex flex-col rounded-[10px] border bg-surface p-3.5", alert?.status === "overdue" ? "border-accent/60" : "border-border")}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="tabular-nums pt-0.5 text-[11px] uppercase tracking-wider text-muted">{item.label}</h3>
        {alert && alert.status !== "ok" && <StatusBadge status={alert.status} />}
      </div>
      {item.value && <div className="mt-1 font-bold">{item.value}</div>}
      {item.details.length > 0 && <div className="tabular-nums mt-0.5 text-[11px] text-muted">{item.details.join(" · ")}</div>}
      {alert ? (
        <>
          <GaugeBar gauge={gauge} status={alert.status} label={text ? `${item.label}: ${text.left}` : `${item.label}: sem histórico`} />
          <div className="tabular-nums mt-1.5 flex items-baseline justify-between gap-2 text-[11px]">
            <span className="text-muted">{text ? text.used : "sem histórico de troca"}</span>
            {text && <span className={alert.status === "ok" ? "text-fg/80" : "text-accent"}>{text.left}</span>}
          </div>
          <div className="mt-auto pt-3">
            <div className="flex items-end justify-between gap-2 border-t border-border pt-2.5">
              <div className="tabular-nums min-w-0 text-[11px] leading-relaxed text-muted">
                {item.interval && <div className="truncate">{item.interval}</div>}
                <div className="truncate">{last ? `última: ${last}` : "registre a última troca"}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={onRegister} title={`Registrar ${alert.label.toLowerCase()}`}><Plus size={13} /> Registrar</Button>
            </div>
          </div>
        </>
      ) : (
        <p className="tabular-nums mt-2 text-[11px] text-muted/70">{item.interval ?? "sem intervalo na ficha"}</p>
      )}
    </div>
  );
}

// Spec sheet and service state in one place. "Registrar" opens "Nova manutenção" filled in with
// the item; `register` (?registrar=<rule> from the dashboard) opens the same form on arrival.
export function TelemetryGrid({ vehicleId, items, notes, form, register }: {
  vehicleId: string;
  items: TelemetryItem[];
  notes?: string;
  form: MaintenanceFormProps;
  register?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const draftFor = (ruleId: string): MaintDraft | null => {
    const r = form.specRules.find((x) => x.id === ruleId);
    return r ? { category: r.category, specRuleIds: [r.id], title: r.label, km: form.currentKm } : null;
  };
  const [draft, setDraft] = useState<MaintDraft | null>(() => (register ? draftFor(register) : null));

  // Drop the param so a refresh or a later visit doesn't reopen the form.
  useEffect(() => {
    if (register) router.replace(pathname, { scroll: false });
  }, [register, router, pathname]);

  const editHref = `/garage/${vehicleId}/spec/edit`;
  return (
    <section id="ficha" className="mb-8 scroll-mt-6">
      <SectionHeading action={<Link href={editHref} className={buttonClass({ variant: "ghost", size: "sm" })}><Pencil size={13} /> Editar ficha</Link>}>
        Ficha de troca
      </SectionHeading>
      {items.length === 0 && !notes ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-dashed border-border p-4">
          <p className="text-xs text-muted">Ficha vazia: preencha os intervalos para acompanhar óleo, filtros, pneus e afins</p>
          <Link href={editHref} className={buttonClass({ variant: "outline", size: "sm" })}>Preencher ficha</Link>
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <TelemetryCard key={item.key} item={item} onRegister={item.alert ? () => setDraft(draftFor(item.alert!.id)) : undefined} />
          ))}
        </div>
      )}
      {notes && (
        <p className="tabular-nums mt-3 flex gap-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted">
          <StickyNote size={14} aria-hidden className="mt-px shrink-0" />{notes}
        </p>
      )}
      <MaintenanceForm {...form} draft={draft ?? undefined} open={draft != null} onOpenChange={(open) => { if (!open) setDraft(null); }} />
    </section>
  );
}
