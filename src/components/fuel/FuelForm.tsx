"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { FuelType } from "@prisma/client";
import { createFuelRecord, updateFuelRecord } from "@/actions/fuel";
import { FormDialog, type FormDialogApi } from "@/components/common/FormDialog";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DecimalInput, IntegerInput, MoneyInput } from "@/components/ui/masked-input";
import { Textarea } from "@/components/ui/textarea";
import { litersOf, litersToMl, pricePerLiterCents } from "@/domain/fuel";
import { FUEL_LABELS, FUEL_TYPES } from "@/lib/categories";
import { centsToBRL, realToCents } from "@/lib/money";
import { todayInputValue } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { FuelRecordView } from "./FuelRow";

export type FuelFormProps = { vehicleId: string; currentKm: number };

export function FuelForm({ record, trigger, ...props }: FuelFormProps & { record?: FuelRecordView; trigger: React.ReactNode }) {
  return (
    <FormDialog title={record ? "Editar abastecimento" : "Novo abastecimento"} trigger={trigger}>
      {(api) => <FuelFields {...props} record={record} {...api} />}
    </FormDialog>
  );
}

// Same cleanup MoneyInput applies to what's typed, so the hint reads the value the field will show.
const typedCents = (text: string) => realToCents(text.replace(/[^\d.,]/g, "") || "0");

function FuelFields({ vehicleId, currentKm, record, close, setBusy }: FuelFormProps & FormDialogApi & { record?: FuelRecordView }) {
  const router = useRouter();
  const [liters, setLiters] = useState<number | null>(record ? litersOf(record.volumeMl) : null);
  const [costCents, setCostCents] = useState(record?.costCents ?? 0);
  const [fuel, setFuel] = useState<FuelType>(record?.fuel ?? "GASOLINE");
  const [fullTank, setFullTank] = useState(record?.fullTank ?? true);
  const [pending, setPending] = useState(false);
  const hintId = useId();
  const perLiter = liters ? pricePerLiterCents(costCents, litersToMl(liters)) : null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    const payload = {
      date: String(fd.get("date") ?? ""),
      km: String(fd.get("km") ?? ""),
      volumeMl: liters ? litersToMl(liters) : 0,
      costCents: realToCents(String(fd.get("cost") ?? "") || "0"),
      fuel,
      fullTank,
      station: String(fd.get("station") ?? ""),
      notes: String(fd.get("notes") ?? ""),
    };
    setPending(true);
    setBusy(true);
    try {
      const res = record ? await updateFuelRecord(record.id, payload) : await createFuelRecord(vehicleId, payload);
      if (!res.ok) { toast.error(res.error); return; }
      const km = res.data.odometerUpdatedTo;
      const done = record ? "Abastecimento atualizado" : "Abastecimento registrado";
      toast.success(km != null ? `${done} · odômetro atualizado para ${km.toLocaleString("pt-BR")} km` : done);
      close();
      router.refresh();
    } finally {
      setPending(false);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data"><Input name="date" type="date" defaultValue={record ? record.date.slice(0, 10) : todayInputValue()} required /></Field>
        <Field label="Km"><IntegerInput name="km" suffix="km" required defaultValue={record?.km} placeholder={`atual: ${currentKm.toLocaleString("pt-BR")}`} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Litros"><DecimalInput suffix="L" required value={liters} onValueChange={setLiters} placeholder="0,00" /></Field>
        <Field label="Total pago" hint={perLiter != null ? `${centsToBRL(perLiter)}/L` : "R$ —/L"}>
          <MoneyInput name="cost" defaultCents={record?.costCents} onInput={(e) => setCostCents(typedCents(e.currentTarget.value))} />
        </Field>
      </div>
      <Field label="Combustível" group>
        <div className="flex flex-wrap gap-1.5">
          {FUEL_TYPES.map((t) => (
            <Chip key={t} selected={t === fuel} disabled={pending} onClick={() => setFuel(t)}>{FUEL_LABELS[t]}</Chip>
          ))}
        </div>
      </Field>
      <div>
        <button type="button" role="switch" aria-checked={fullTank} aria-describedby={hintId} disabled={pending} onClick={() => setFullTank((v) => !v)}
          className={cn(
            "flex h-10 w-full cursor-pointer items-center justify-between gap-3 rounded-lg border bg-surface px-3 text-sm transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50",
            fullTank ? "border-accent/50" : "border-border hover:border-white/25",
          )}>
          Tanque cheio
          <span aria-hidden className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", fullTank ? "bg-accent" : "bg-white/15")}>
            <span className={cn("absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-fg transition-transform", fullTank && "translate-x-4")} />
          </span>
        </button>
        <p id={hintId} className="tabular-nums mt-1 text-[11px] text-muted">O consumo (km/l) é medido entre tanques cheios; os parciais entram no próximo cálculo.</p>
      </div>
      <Field label="Posto"><Input name="station" defaultValue={record?.station ?? ""} placeholder="Ex.: Posto do Centro" /></Field>
      <Field label="Notas"><Textarea name="notes" defaultValue={record?.notes ?? ""} /></Field>
      <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
    </form>
  );
}
