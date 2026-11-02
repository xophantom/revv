import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { vehicleSpecSchema, emptySpec } from "@/domain/spec-schema";
import { specRuleOptions, type AlertInput } from "@/domain/alerts";
import { SpecSheet } from "@/components/spec/SpecSheet";
import { KmEditor } from "@/components/vehicles/KmEditor";
import { VehicleActions } from "@/components/vehicles/VehicleActions";
import { VehicleForm } from "@/components/vehicles/VehicleForm";
import { AlertChips } from "@/components/alerts/AlertChips";
import { CustomAlertForm } from "@/components/alerts/CustomAlertForm";
import { CustomAlertList } from "@/components/alerts/CustomAlertList";
import { MaintenanceList } from "@/components/maintenance/MaintenanceList";
import { UpgradeTimeline } from "@/components/upgrades/UpgradeTimeline";
import { Gallery } from "@/components/gallery/Gallery";
import { VehicleFinance } from "@/components/dashboard/VehicleFinance";
import { summarizeVehicle, type FinanceInput } from "@/domain/finance";
import { todayDateOnly } from "@/lib/dates";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default async function VehiclePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ registrar?: string | string[] }>;
}) {
  const { id } = await params;
  const { registrar } = await searchParams;
  const user = await requireUser();
  const v = await db.vehicle.findUnique({
    where: { id },
    include: {
      spec: true,
      maintenances: { include: { attachments: true }, orderBy: { date: "desc" } },
      upgrades: { include: { attachments: true }, orderBy: { date: "desc" } },
      customAlerts: true,
      attachments: { where: { kind: "image" }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!v || v.userId !== user.id) notFound();
  const spec = v.spec ? vehicleSpecSchema.parse(v.spec.data) : emptySpec();
  const today = todayDateOnly();
  const alertInput: AlertInput = {
    currentKm: v.currentKm,
    today,
    spec,
    maintenances: v.maintenances.map((m) => ({ category: m.category, date: m.date, km: m.km, specRuleIds: m.specRuleIds })),
    customAlerts: v.customAlerts.map((c) => ({ id: c.id, label: c.label, dueKm: c.dueKm, dueDate: c.dueDate, done: c.done })),
  };
  const maintRecords = v.maintenances.map((m) => ({
    id: m.id,
    date: m.date.toISOString(),
    km: m.km,
    category: m.category,
    specRuleIds: m.specRuleIds,
    title: m.title,
    workshop: m.workshop,
    costCents: m.costCents,
    notes: m.notes,
    attachments: m.attachments.map((a) => ({ id: a.id, kind: a.kind, url: `/api/attachments/${a.id}/raw`, fileName: a.fileName, caption: a.caption })),
  }));
  const upgradeRecords = v.upgrades.map((u) => ({
    id: u.id,
    date: u.date.toISOString(),
    name: u.name,
    category: u.category,
    costCents: u.costCents,
    supplier: u.supplier,
    notes: u.notes,
    attachments: u.attachments.map((a) => ({ id: a.id, kind: a.kind, url: `/api/attachments/${a.id}/raw`, fileName: a.fileName, caption: a.caption })),
  }));
  const customAlertRecords = v.customAlerts.map((c) => ({
    id: c.id,
    label: c.label,
    dueKm: c.dueKm,
    dueDate: c.dueDate ? c.dueDate.toISOString() : null,
    done: c.done,
  }));
  const firstKm = v.maintenances.length ? Math.min(...v.maintenances.map((m) => m.km)) : v.currentKm;
  const financeInput: FinanceInput = {
    currentKm: v.currentKm,
    firstKm,
    today,
    maintenances: v.maintenances.map((m) => ({ date: m.date, costCents: m.costCents })),
    upgrades: v.upgrades.map((u) => ({ date: u.date, costCents: u.costCents })),
  };
  const summary = summarizeVehicle(financeInput);
  const form = { vehicleId: v.id, specRules: specRuleOptions(spec), currentKm: v.currentKm };
  const editable = { id: v.id, name: v.name, plate: v.plate, make: v.make, model: v.model, year: v.year, engine: v.engine, color: v.color, currentKm: v.currentKm, photoUrl: v.photoUrl };
  const details = [[v.make, v.model].filter(Boolean).join(" "), v.year, v.engine, v.color].filter(Boolean).join(" · ");
  return (
    <div>
      <section className="mb-6 grid gap-6 md:grid-cols-[300px_1fr]">
        {v.photoUrl ? (
          <div className="h-48 rounded-xl border border-border bg-surface2 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(0deg,rgba(0,0,0,.5),transparent),url(/api/vehicles/${v.id}/photo?v=${encodeURIComponent(v.photoKey ?? "")})` }} />
        ) : (
          <VehicleForm vehicle={editable} trigger={
            <button type="button" className="mono h-48 cursor-pointer rounded-xl border border-dashed border-border bg-surface2 text-xs text-muted transition hover:text-fg">+ adicionar foto</button>
          } />
        )}
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-4xl font-bold">{v.name}</h1>
            <VehicleActions vehicle={editable} />
          </div>
          {(v.plate || details) && (
            <div className="mono mt-2 flex flex-wrap gap-2 text-xs text-muted">
              {v.plate && <span className="rounded bg-white px-2 py-1 font-bold text-bg">{v.plate}</span>}
              {details && <span className="rounded border border-border px-2 py-1">{details}</span>}
            </div>
          )}
          <KmEditor id={v.id} currentKm={v.currentKm} />
          <AlertChips input={alertInput} form={form} register={typeof registrar === "string" ? registrar : undefined} />
        </div>
      </section>
      <section className="mb-6"><SpecSheet vehicleId={v.id} spec={spec} /></section>
      <section id="alertas" className="mb-6 scroll-mt-6">
        <div className="flex items-center justify-between">
          <h2 className="mono text-sm text-accent">// ALERTAS PERSONALIZADOS</h2>
          <CustomAlertForm vehicleId={v.id} />
        </div>
        <CustomAlertList vehicleId={v.id} alerts={customAlertRecords} />
      </section>
      <Tabs defaultValue="maint">
        <TabsList>
          <TabsTrigger value="maint">Manutenções <span className="mono ml-1 text-[10px] text-accent">{v.maintenances.length}</span></TabsTrigger>
          <TabsTrigger value="upg">Upgrades <span className="mono ml-1 text-[10px] text-accent">{v.upgrades.length}</span></TabsTrigger>
          <TabsTrigger value="gallery">Galeria <span className="mono ml-1 text-[10px] text-accent">{v.attachments.length}</span></TabsTrigger>
          <TabsTrigger value="finance">Financeiro</TabsTrigger>
        </TabsList>
        <TabsContent value="maint"><MaintenanceList {...form} records={maintRecords} /></TabsContent>
        <TabsContent value="upg"><UpgradeTimeline vehicleId={v.id} upgrades={upgradeRecords} /></TabsContent>
        <TabsContent value="gallery"><Gallery images={v.attachments.map((a) => ({ url: `/api/attachments/${a.id}/raw`, caption: a.caption }))} /></TabsContent>
        <TabsContent value="finance"><VehicleFinance summary={summary} /></TabsContent>
      </Tabs>
    </div>
  );
}
