import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { vehicleSpecSchema, emptySpec } from "@/domain/spec-schema";
import { specRuleOptions, type AlertInput } from "@/domain/alerts";
import { SpecSheet } from "@/components/spec/SpecSheet";
import { KmEditor } from "@/components/vehicles/KmEditor";
import { AlertChips } from "@/components/alerts/AlertChips";
import { MaintenanceList } from "@/components/maintenance/MaintenanceList";
import { UpgradeTimeline } from "@/components/upgrades/UpgradeTimeline";
import { Gallery } from "@/components/gallery/Gallery";
import { VehicleFinance } from "@/components/dashboard/VehicleFinance";
import { summarizeVehicle, type FinanceInput } from "@/domain/finance";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
  const alertInput: AlertInput = {
    currentKm: v.currentKm,
    today: new Date(),
    spec,
    maintenances: v.maintenances.map((m) => ({ category: m.category, date: m.date, km: m.km, specRuleId: m.specRuleId })),
    customAlerts: v.customAlerts.map((c) => ({ id: c.id, label: c.label, dueKm: c.dueKm, dueDate: c.dueDate, done: c.done })),
  };
  const maintRecords = v.maintenances.map((m) => ({
    id: m.id,
    date: m.date.toISOString(),
    km: m.km,
    category: m.category,
    title: m.title,
    workshop: m.workshop,
    costCents: m.costCents,
    notes: m.notes,
    attachments: m.attachments.map((a) => ({ id: a.id, kind: a.kind, url: a.url, fileName: a.fileName, caption: a.caption })),
  }));
  const upgradeRecords = v.upgrades.map((u) => ({
    id: u.id,
    date: u.date.toISOString(),
    name: u.name,
    category: u.category,
    costCents: u.costCents,
    supplier: u.supplier,
    notes: u.notes,
    attachments: u.attachments.map((a) => ({ id: a.id, kind: a.kind, url: a.url, fileName: a.fileName, caption: a.caption })),
  }));
  const firstKm = v.maintenances.length ? Math.min(...v.maintenances.map((m) => m.km)) : v.currentKm;
  const financeInput: FinanceInput = {
    currentKm: v.currentKm,
    firstKm,
    maintenances: v.maintenances.map((m) => ({ date: m.date, costCents: m.costCents })),
    upgrades: v.upgrades.map((u) => ({ date: u.date, costCents: u.costCents })),
  };
  const summary = summarizeVehicle(financeInput);
  const monthlyAvgCents = Math.round(summary.totalCents / Math.max(1, summary.byMonth.length));
  return (
    <div>
      <section className="mb-6 grid gap-6 md:grid-cols-[300px_1fr]">
        <div className="h-48 rounded-xl border border-border bg-surface2 bg-cover bg-center" style={v.photoUrl ? { backgroundImage: `linear-gradient(0deg,rgba(0,0,0,.5),transparent),url(${v.photoUrl})` } : undefined} />
        <div>
          <h1 className="text-4xl font-bold">{v.name}</h1>
          <div className="mono mt-2 flex flex-wrap gap-2 text-xs text-muted">
            <span className="rounded bg-white px-2 py-1 font-bold text-bg">{v.plate ?? "—"}</span>
            <span className="rounded border border-border px-2 py-1">{v.year ?? "—"}{v.engine ? " · " + v.engine : ""}</span>
          </div>
          <KmEditor id={v.id} currentKm={v.currentKm} />
          <AlertChips {...alertInput} />
        </div>
      </section>
      <section className="mb-6"><SpecSheet vehicleId={v.id} spec={spec} /></section>
      <Tabs defaultValue="maint">
        <TabsList>
          <TabsTrigger value="maint">Manutenções <span className="mono ml-1 text-[10px] text-accent">{v.maintenances.length}</span></TabsTrigger>
          <TabsTrigger value="upg">Upgrades <span className="mono ml-1 text-[10px] text-accent">{v.upgrades.length}</span></TabsTrigger>
          <TabsTrigger value="gallery">Galeria <span className="mono ml-1 text-[10px] text-accent">{v.attachments.length}</span></TabsTrigger>
          <TabsTrigger value="finance">Financeiro</TabsTrigger>
        </TabsList>
        <TabsContent value="maint"><MaintenanceList vehicleId={v.id} specRules={specRuleOptions(spec)} records={maintRecords} /></TabsContent>
        <TabsContent value="upg"><UpgradeTimeline vehicleId={v.id} upgrades={upgradeRecords} /></TabsContent>
        <TabsContent value="gallery"><Gallery images={v.attachments.map((a) => ({ url: a.url, caption: a.caption }))} /></TabsContent>
        <TabsContent value="finance"><VehicleFinance summary={summary} monthlyAvgCents={monthlyAvgCents} /></TabsContent>
      </Tabs>
    </div>
  );
}
