"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { upsertSpec } from "@/actions/spec";
import type { VehicleSpecData } from "@/domain/spec-schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Group = Exclude<keyof VehicleSpecData, "freeNotes">;

export function SpecEditForm({ vehicleId, initial }: { vehicleId: string; initial: VehicleSpecData }) {
  const router = useRouter();
  const [spec, setSpec] = useState<VehicleSpecData>(initial);
  const [saving, setSaving] = useState(false);

  // Update a string/select field on a group.
  function setStr<G extends Group>(group: G, field: keyof NonNullable<VehicleSpecData[G]>, value: string) {
    setSpec((prev) => {
      const next = { ...prev } as Record<string, Record<string, unknown> | undefined>;
      const g = { ...(next[group] ?? {}) };
      if (value === "") delete g[field as string];
      else g[field as string] = value;
      next[group] = g;
      return next as VehicleSpecData;
    });
  }

  // Update a numeric field; empty string clears it (undefined).
  function setNum<G extends Group>(group: G, field: keyof NonNullable<VehicleSpecData[G]>, value: string) {
    setSpec((prev) => {
      const next = { ...prev } as Record<string, Record<string, unknown> | undefined>;
      const g = { ...(next[group] ?? {}) };
      if (value === "" || Number.isNaN(Number(value))) delete g[field as string];
      else g[field as string] = Number(value);
      next[group] = g;
      return next as VehicleSpecData;
    });
  }

  // Read current value of a field as a string for controlled inputs.
  function get<G extends Group>(group: G, field: keyof NonNullable<VehicleSpecData[G]>): string {
    const g = spec[group] as Record<string, unknown> | undefined;
    const v = g?.[field as string];
    return v == null ? "" : String(v);
  }

  // Build a clean nested object: drop empty fields and empty groups.
  function clean(): VehicleSpecData {
    const out: Record<string, unknown> = {};
    const groups: Group[] = [
      "engineOil", "oilFilter", "transmissionOil", "airFilter", "fuelFilter",
      "cabinFilter", "timingBelt", "tires", "sparkPlugs", "brakeFluid", "coolant",
    ];
    for (const group of groups) {
      const g = spec[group];
      if (!g) continue;
      const entries = Object.entries(g).filter(([, v]) => v !== undefined && v !== "");
      if (entries.length > 0) {
        out[group] = Object.fromEntries(entries);
      }
    }
    if (spec.freeNotes && spec.freeNotes.trim() !== "") out.freeNotes = spec.freeNotes;
    return out as VehicleSpecData;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await upsertSpec(vehicleId, clean());
    setSaving(false);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Ficha salva");
    router.push(`/garage/${vehicleId}`);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <Section title="// ÓLEO DO MOTOR">
        <Field label="Tipo"><Input value={get("engineOil", "type")} onChange={(e) => setStr("engineOil", "type", e.target.value)} /></Field>
        <Field label="Marca"><Input value={get("engineOil", "brand")} onChange={(e) => setStr("engineOil", "brand", e.target.value)} /></Field>
        <Field label="Capacidade (L)"><Input type="number" step="0.1" value={get("engineOil", "capacityL")} onChange={(e) => setNum("engineOil", "capacityL", e.target.value)} /></Field>
        <Field label="Intervalo (km)"><Input type="number" value={get("engineOil", "intervalKm")} onChange={(e) => setNum("engineOil", "intervalKm", e.target.value)} /></Field>
        <Field label="Intervalo (meses)"><Input type="number" value={get("engineOil", "intervalMonths")} onChange={(e) => setNum("engineOil", "intervalMonths", e.target.value)} /></Field>
      </Section>

      <Section title="// FILTRO DE ÓLEO">
        <Field label="Marca"><Input value={get("oilFilter", "brand")} onChange={(e) => setStr("oilFilter", "brand", e.target.value)} /></Field>
        <Field label="Observação"><Input value={get("oilFilter", "note")} onChange={(e) => setStr("oilFilter", "note", e.target.value)} /></Field>
      </Section>

      <Section title="// ÓLEO DO CÂMBIO">
        <Field label="Tipo"><Input value={get("transmissionOil", "type")} onChange={(e) => setStr("transmissionOil", "type", e.target.value)} /></Field>
        <Field label="Intervalo (km)"><Input type="number" value={get("transmissionOil", "intervalKm")} onChange={(e) => setNum("transmissionOil", "intervalKm", e.target.value)} /></Field>
      </Section>

      <Section title="// FILTRO DE AR">
        <Field label="Intervalo (km)"><Input type="number" value={get("airFilter", "intervalKm")} onChange={(e) => setNum("airFilter", "intervalKm", e.target.value)} /></Field>
      </Section>

      <Section title="// FILTRO DE COMBUSTÍVEL">
        <Field label="Intervalo (km)"><Input type="number" value={get("fuelFilter", "intervalKm")} onChange={(e) => setNum("fuelFilter", "intervalKm", e.target.value)} /></Field>
      </Section>

      <Section title="// FILTRO DE CABINE">
        <Field label="Intervalo (km)"><Input type="number" value={get("cabinFilter", "intervalKm")} onChange={(e) => setNum("cabinFilter", "intervalKm", e.target.value)} /></Field>
      </Section>

      <Section title="// CORREIA / CORRENTE">
        <Field label="Tipo">
          <select value={get("timingBelt", "kind")} onChange={(e) => setStr("timingBelt", "kind", e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent">
            <option value="">—</option>
            <option value="chain">Corrente</option>
            <option value="belt">Correia</option>
          </select>
        </Field>
        <Field label="Intervalo (km)"><Input type="number" value={get("timingBelt", "intervalKm")} onChange={(e) => setNum("timingBelt", "intervalKm", e.target.value)} /></Field>
        <Field label="Última troca (km)"><Input type="number" value={get("timingBelt", "lastChangeKm")} onChange={(e) => setNum("timingBelt", "lastChangeKm", e.target.value)} /></Field>
      </Section>

      <Section title="// PNEUS">
        <Field label="Medida"><Input value={get("tires", "size")} onChange={(e) => setStr("tires", "size", e.target.value)} /></Field>
        <Field label="PSI dianteiro"><Input type="number" value={get("tires", "psiFront")} onChange={(e) => setNum("tires", "psiFront", e.target.value)} /></Field>
        <Field label="PSI traseiro"><Input type="number" value={get("tires", "psiRear")} onChange={(e) => setNum("tires", "psiRear", e.target.value)} /></Field>
        <Field label="Rodízio (km)"><Input type="number" value={get("tires", "rotationKm")} onChange={(e) => setNum("tires", "rotationKm", e.target.value)} /></Field>
      </Section>

      <Section title="// VELAS">
        <Field label="Tipo"><Input value={get("sparkPlugs", "type")} onChange={(e) => setStr("sparkPlugs", "type", e.target.value)} /></Field>
        <Field label="Intervalo (km)"><Input type="number" value={get("sparkPlugs", "intervalKm")} onChange={(e) => setNum("sparkPlugs", "intervalKm", e.target.value)} /></Field>
      </Section>

      <Section title="// FLUIDO DE FREIO">
        <Field label="Tipo">
          <select value={get("brakeFluid", "type")} onChange={(e) => setStr("brakeFluid", "type", e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent">
            <option value="">—</option>
            <option value="DOT3">DOT3</option>
            <option value="DOT4">DOT4</option>
            <option value="DOT5.1">DOT5.1</option>
          </select>
        </Field>
        <Field label="Intervalo (meses)"><Input type="number" value={get("brakeFluid", "intervalMonths")} onChange={(e) => setNum("brakeFluid", "intervalMonths", e.target.value)} /></Field>
      </Section>

      <Section title="// ARREFECIMENTO">
        <Field label="Tipo"><Input value={get("coolant", "type")} onChange={(e) => setStr("coolant", "type", e.target.value)} /></Field>
        <Field label="Intervalo (meses)"><Input type="number" value={get("coolant", "intervalMonths")} onChange={(e) => setNum("coolant", "intervalMonths", e.target.value)} /></Field>
      </Section>

      <div>
        <span className="mono mb-2 block text-xs tracking-widest text-accent">// OBSERVAÇÕES</span>
        <Textarea value={spec.freeNotes ?? ""} onChange={(e) => setSpec((p) => ({ ...p, freeNotes: e.target.value }))} />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving} className="bg-accent text-bg">{saving ? "Salvando..." : "Salvar ficha"}</Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-border bg-surface p-4">
      <legend className="mono px-1 text-xs tracking-widest text-accent">{title}</legend>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{children}</div>
    </fieldset>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
