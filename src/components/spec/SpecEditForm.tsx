"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { upsertSpec } from "@/actions/spec";
import type { VehicleSpecData } from "@/domain/spec-schema";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DecimalInput, IntegerInput } from "@/components/ui/masked-input";
import { Textarea } from "@/components/ui/textarea";

type Group = Exclude<keyof VehicleSpecData, "freeNotes">;
type FieldOf<G extends Group> = keyof NonNullable<VehicleSpecData[G]>;

const GROUPS: Group[] = [
  "engineOil", "oilFilter", "transmissionOil", "airFilter", "fuelFilter",
  "cabinFilter", "timingBelt", "tires", "sparkPlugs", "brakeFluid", "coolant",
];

export function SpecEditForm({ vehicleId, initial }: { vehicleId: string; initial: VehicleSpecData }) {
  const router = useRouter();
  const [spec, setSpec] = useState<VehicleSpecData>(initial);
  const [saving, setSaving] = useState(false);

  // Sets a field on a group; "" or null clears it.
  function set<G extends Group>(group: G, field: FieldOf<G>, value: string | number | null) {
    setSpec((prev) => {
      const next = { ...prev } as Record<string, Record<string, unknown> | undefined>;
      const g = { ...(next[group] ?? {}) };
      if (value === "" || value == null) delete g[field as string];
      else g[field as string] = value;
      next[group] = g;
      return next as VehicleSpecData;
    });
  }

  function value<G extends Group>(group: G, field: FieldOf<G>): unknown {
    return (spec[group] as Record<string, unknown> | undefined)?.[field as string];
  }
  const str = <G extends Group>(group: G, field: FieldOf<G>) => String(value(group, field) ?? "");
  const num = <G extends Group>(group: G, field: FieldOf<G>) => (value(group, field) as number | undefined) ?? null;

  // Text, whole-number and decimal inputs bound to a spec field.
  const text = <G extends Group>(group: G, field: FieldOf<G>, placeholder?: string) =>
    <Input value={str(group, field)} placeholder={placeholder} onChange={(e) => set(group, field, e.target.value)} />;
  const int = <G extends Group>(group: G, field: FieldOf<G>, suffix?: string) =>
    <IntegerInput suffix={suffix} value={num(group, field)} onValueChange={(n) => set(group, field, n)} />;
  const decimal = <G extends Group>(group: G, field: FieldOf<G>, suffix?: string) =>
    <DecimalInput suffix={suffix} value={num(group, field)} onValueChange={(n) => set(group, field, n)} />;
  // Pick one option; picking the selected one again clears it.
  const choice = <G extends Group>(group: G, field: FieldOf<G>, options: [string, string][]) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, label]) => (
        <Chip key={v} selected={str(group, field) === v} onClick={() => set(group, field, str(group, field) === v ? null : v)}>{label}</Chip>
      ))}
    </div>
  );

  // Drops empty fields and empty groups.
  function clean(): VehicleSpecData {
    const out: Record<string, unknown> = {};
    for (const group of GROUPS) {
      const entries = Object.entries(spec[group] ?? {}).filter(([, v]) => v !== undefined && v !== "");
      if (entries.length > 0) out[group] = Object.fromEntries(entries);
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
      <p className="tabular-nums text-xs text-muted">Os intervalos ligam os alertas e os cards da ficha. Deixe em branco o que não se aplica.</p>
      <Section title="Óleo do motor">
        <Field label="Tipo">{text("engineOil", "type", "5W30")}</Field>
        <Field label="Marca">{text("engineOil", "brand")}</Field>
        <Field label="Capacidade">{decimal("engineOil", "capacityL", "L")}</Field>
        <Field label="Intervalo em km">{int("engineOil", "intervalKm", "km")}</Field>
        <Field label="Intervalo em meses">{int("engineOil", "intervalMonths", "meses")}</Field>
      </Section>

      <Section title="Filtro de óleo">
        <Field label="Marca">{text("oilFilter", "brand")}</Field>
        <Field label="Observação">{text("oilFilter", "note")}</Field>
      </Section>

      <Section title="Óleo do câmbio">
        <Field label="Tipo">{text("transmissionOil", "type")}</Field>
        <Field label="Intervalo">{int("transmissionOil", "intervalKm", "km")}</Field>
      </Section>

      <Section title="Filtros">
        <Field label="Filtro de ar">{int("airFilter", "intervalKm", "km")}</Field>
        <Field label="Filtro de combustível">{int("fuelFilter", "intervalKm", "km")}</Field>
        <Field label="Filtro de cabine">{int("cabinFilter", "intervalKm", "km")}</Field>
      </Section>

      <Section title="Correia / corrente">
        <Field label="Tipo" group>{choice("timingBelt", "kind", [["belt", "Correia"], ["chain", "Corrente"]])}</Field>
        <Field label="Intervalo">{int("timingBelt", "intervalKm", "km")}</Field>
        <Field label="Última troca" hint="Usado enquanto não houver manutenção registrada">{int("timingBelt", "lastChangeKm", "km")}</Field>
      </Section>

      <Section title="Pneus">
        <Field label="Medida">{text("tires", "size", "205/55 R16")}</Field>
        <Field label="Pressão dianteira">{decimal("tires", "psiFront", "psi")}</Field>
        <Field label="Pressão traseira">{decimal("tires", "psiRear", "psi")}</Field>
        <Field label="Rodízio">{int("tires", "rotationKm", "km")}</Field>
      </Section>

      <Section title="Velas">
        <Field label="Tipo">{text("sparkPlugs", "type")}</Field>
        <Field label="Intervalo">{int("sparkPlugs", "intervalKm", "km")}</Field>
      </Section>

      <Section title="Fluido de freio">
        <Field label="Tipo" group>{choice("brakeFluid", "type", [["DOT3", "DOT 3"], ["DOT4", "DOT 4"], ["DOT5.1", "DOT 5.1"]])}</Field>
        <Field label="Intervalo">{int("brakeFluid", "intervalMonths", "meses")}</Field>
      </Section>

      <Section title="Arrefecimento">
        <Field label="Tipo">{text("coolant", "type")}</Field>
        <Field label="Intervalo">{int("coolant", "intervalMonths", "meses")}</Field>
      </Section>

      <Field label="Observações">
        <Textarea value={spec.freeNotes ?? ""} placeholder="Ex.: sempre gasolina aditivada; ajustar válvulas a cada 30k"
          onChange={(e) => setSpec((p) => ({ ...p, freeNotes: e.target.value }))} />
      </Field>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar ficha"}</Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-border bg-surface p-4">
      <legend className="tabular-nums px-1 text-xs uppercase tracking-widest text-accent">{"// "}{title}</legend>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{children}</div>
    </fieldset>
  );
}
