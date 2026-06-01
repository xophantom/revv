import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { vehicleSpecSchema, emptySpec } from "@/domain/spec-schema";
import { SpecSheet } from "@/components/spec/SpecSheet";
import { KmEditor } from "@/components/vehicles/KmEditor";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const v = await db.vehicle.findUnique({
    where: { id },
    include: { spec: true, maintenances: { orderBy: { date: "desc" } }, upgrades: { orderBy: { date: "desc" } }, customAlerts: true, attachments: { where: { kind: "image" }, orderBy: { createdAt: "desc" } } },
  });
  if (!v || v.userId !== user.id) notFound();
  const spec = v.spec ? vehicleSpecSchema.parse(v.spec.data) : emptySpec();
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
          {/* AlertChips wired in Phase 2 (Task 2.3) */}
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
        <TabsContent value="maint"><p className="mono text-sm text-muted">// manutenções — em breve (Fase 2)</p></TabsContent>
        <TabsContent value="upg"><p className="mono text-sm text-muted">// upgrades — em breve (Fase 2)</p></TabsContent>
        <TabsContent value="gallery"><p className="mono text-sm text-muted">// galeria — em breve (Fase 2)</p></TabsContent>
        <TabsContent value="finance"><p className="mono text-sm text-muted">// financeiro — em breve (Fase 3)</p></TabsContent>
      </Tabs>
    </div>
  );
}
