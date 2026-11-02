import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { vehicleSpecSchema, emptySpec } from "@/domain/spec-schema";
import { ChevronLeft, ImagePlus } from "lucide-react";
import { computeAlerts, specRuleOptions, type AlertInput } from "@/domain/alerts";
import { telemetryItems } from "@/domain/telemetry";
import { TelemetryGrid } from "@/components/spec/TelemetryGrid";
import { KmEditor } from "@/components/vehicles/KmEditor";
import { VehicleActions } from "@/components/vehicles/VehicleActions";
import { VehicleForm } from "@/components/vehicles/VehicleForm";
import { AlertSummary } from "@/components/alerts/AlertSummary";
import { CustomAlertForm } from "@/components/alerts/CustomAlertForm";
import { CustomAlertList } from "@/components/alerts/CustomAlertList";
import { MaintenanceList } from "@/components/maintenance/MaintenanceList";
import { UpgradeTimeline } from "@/components/upgrades/UpgradeTimeline";
import { FuelList } from "@/components/fuel/FuelList";
import { Gallery } from "@/components/gallery/Gallery";
import { VehicleFinance } from "@/components/dashboard/VehicleFinance";
import { firstLoggedKm, toFinanceEntries } from "@/domain/finance";
import { alertDetail } from "@/lib/alert-text";
import { todayDateOnly } from "@/lib/dates";
import { SectionHeading } from "@/components/ui/panel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const user = await requireUser();
  const v = await db.vehicle.findUnique({ where: { id }, select: { name: true, userId: true } });
  return { title: v && v.userId === user.id ? v.name : "Veículo" };
}

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
      fuelRecords: true, // ordered by the fuel domain (date, then km)
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
    customAlerts: v.customAlerts.map((c) => ({ id: c.id, label: c.label, dueKm: c.dueKm, dueDate: c.dueDate, done: c.done, repeatMonths: c.repeatMonths, repeatKm: c.repeatKm })),
  };
  const alerts = computeAlerts(alertInput);
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
  const customAlertRecords = v.customAlerts.map((c) => {
    const state = alerts.find((a) => a.source === "custom" && a.id === c.id); // absent when done
    return {
      id: c.id,
      label: c.label,
      dueKm: c.dueKm,
      dueDate: c.dueDate ? c.dueDate.toISOString() : null,
      done: c.done,
      repeatMonths: c.repeatMonths,
      repeatKm: c.repeatKm,
      status: state?.status,
      detail: state && alertDetail(state),
    };
  });
  const form = { vehicleId: v.id, specRules: specRuleOptions(spec), currentKm: v.currentKm };
  const editable = { id: v.id, name: v.name, plate: v.plate, make: v.make, model: v.model, year: v.year, engine: v.engine, color: v.color, currentKm: v.currentKm, photoUrl: v.photoUrl };
  const details = [[v.make, v.model].filter(Boolean).join(" "), v.year, v.engine, v.color].filter(Boolean).join(" · ");
  return (
    <div>
      <Link href="/garage" className="tabular-nums -mt-2 mb-4 inline-flex items-center gap-1 text-xs text-muted transition hover:text-fg">
        <ChevronLeft size={14} aria-hidden /> Garagem
      </Link>
      <section className="mb-6 grid gap-6 md:grid-cols-[300px_1fr]">
        {v.photoUrl ? (
          <div className="relative h-48 overflow-hidden rounded-xl border border-border bg-surface2">
            {/* eslint-disable-next-line @next/next/no-img-element -- auth-gated route: next/image's optimizer can't send the session */}
            <img src={`/api/vehicles/${v.id}/photo?v=${encodeURIComponent(v.photoKey ?? "")}`} alt={v.name} decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
        ) : (
          <VehicleForm vehicle={editable} trigger={
            <button type="button" className="tabular-nums flex h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface2 text-xs text-muted transition hover:border-white/25 hover:text-fg">
              <ImagePlus size={22} aria-hidden /> adicionar foto
            </button>
          } />
        )}
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="break-words text-3xl font-bold sm:text-4xl">{v.name}</h1>
            <VehicleActions vehicle={editable} />
          </div>
          {(v.plate || details) && (
            <div className="tabular-nums mt-2 flex flex-wrap gap-2 text-xs text-muted">
              {v.plate && <span className="rounded bg-white px-2 py-1 font-bold text-bg">{v.plate}</span>}
              {details && <span className="rounded border border-border px-2 py-1">{details}</span>}
            </div>
          )}
          <KmEditor id={v.id} currentKm={v.currentKm} />
          <AlertSummary alerts={alerts} />
        </div>
      </section>
      <TelemetryGrid vehicleId={v.id} items={telemetryItems(spec, alerts)} notes={spec.freeNotes} form={form}
        register={typeof registrar === "string" ? registrar : undefined} />
      <section id="alertas" className="mb-8 scroll-mt-6">
        <SectionHeading action={<CustomAlertForm vehicleId={v.id} />}>Alertas personalizados</SectionHeading>
        <CustomAlertList vehicleId={v.id} alerts={customAlertRecords} />
      </section>
      <Tabs defaultValue="maint">
        <TabsList>
          <TabsTrigger value="maint">Manutenções <span className="tabular-nums ml-1.5 text-[11px] text-accent">{v.maintenances.length}</span></TabsTrigger>
          <TabsTrigger value="upg">Upgrades <span className="tabular-nums ml-1.5 text-[11px] text-accent">{v.upgrades.length}</span></TabsTrigger>
          <TabsTrigger value="fuel">Abastecimento <span className="tabular-nums ml-1.5 text-[11px] text-accent">{v.fuelRecords.length}</span></TabsTrigger>
          <TabsTrigger value="gallery">Galeria <span className="tabular-nums ml-1.5 text-[11px] text-accent">{v.attachments.length}</span></TabsTrigger>
          <TabsTrigger value="finance">Financeiro</TabsTrigger>
        </TabsList>
        <TabsContent value="maint"><MaintenanceList {...form} records={maintRecords} /></TabsContent>
        <TabsContent value="upg"><UpgradeTimeline vehicleId={v.id} upgrades={upgradeRecords} /></TabsContent>
        <TabsContent value="fuel"><FuelList vehicleId={v.id} currentKm={v.currentKm} records={v.fuelRecords} /></TabsContent>
        <TabsContent value="gallery"><Gallery images={v.attachments.map((a) => ({ url: `/api/attachments/${a.id}/raw`, caption: a.caption }))} /></TabsContent>
        <TabsContent value="finance"><VehicleFinance entries={toFinanceEntries(v)} currentKm={v.currentKm} firstKm={firstLoggedKm(v)} today={today} /></TabsContent>
      </Tabs>
    </div>
  );
}
