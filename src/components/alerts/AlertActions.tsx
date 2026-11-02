"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AlertStatus } from "@/domain/alerts";
import { MaintenanceForm, type MaintDraft, type MaintenanceFormProps } from "@/components/maintenance/MaintenanceForm";

const STYLE: Record<string, string> = {
  overdue: "bg-accent/20 border-accent text-accent",
  soon: "bg-accent/10 border-accent/40 text-accent",
  unknown: "border-border text-muted",
};
const chip = "mono flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] transition hover:border-accent hover:text-accent";

export type AlertChip = { id: string; label: string; status: AlertStatus; source: "spec" | "custom"; detail: string };

// Spec chips open "Nova manutenção" filled in with the item; custom ones jump to their list.
// `register` (?registrar=<rule> from the dashboard) opens the same form on arrival.
export function AlertActions({ alerts, form, register }: { alerts: AlertChip[]; form: MaintenanceFormProps; register?: string }) {
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

  return (
    <>
      {alerts.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {alerts.map((a) => {
            const body = <><span className="h-1.5 w-1.5 rounded-full bg-current" /> {a.label} · {a.detail}</>;
            const className = `${chip} ${STYLE[a.status] ?? STYLE.unknown}`;
            return a.source === "spec" ? (
              <button key={a.id} type="button" title="Registrar manutenção" onClick={() => setDraft(draftFor(a.id))} className={`${className} cursor-pointer`}>
                {body} <span aria-hidden className="opacity-60">+</span>
              </button>
            ) : (
              <a key={a.id} href="#alertas" className={className}>{body}</a>
            );
          })}
        </div>
      )}
      <MaintenanceForm {...form} draft={draft ?? undefined} open={draft != null} onOpenChange={(open) => { if (!open) setDraft(null); }} />
    </>
  );
}
