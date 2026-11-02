"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createCustomAlert, updateCustomAlert } from "@/actions/alerts";
import { FormDialog, type FormDialogApi } from "@/components/common/FormDialog";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { IntegerInput } from "@/components/ui/masked-input";
import { Segmented } from "@/components/ui/segmented";
import type { CustomAlertRecord } from "./CustomAlertList";

type RepeatMode = "none" | "months" | "km";

const REPEAT_OPTIONS = [
  { value: "none", label: "Não repete" },
  { value: "months", label: "Meses" },
  { value: "km", label: "Km" },
] as const satisfies readonly { value: RepeatMode; label: string }[];

const MONTH_CHOICES = [{ months: 1, label: "Mensal" }, { months: 12, label: "Anual" }];

// Yearly documents: the preset fills the description and the repeat; the date is still the user's.
const PRESETS = ["IPVA", "Licenciamento", "Seguro"];

export function CustomAlertForm({ vehicleId, alert, trigger }: { vehicleId: string; alert?: CustomAlertRecord; trigger?: React.ReactNode }) {
  return (
    <FormDialog title={alert ? "Editar alerta" : "Novo alerta"} trigger={trigger ?? <Button variant="outline" size="sm"><Plus size={14} /> Alerta</Button>}>
      {(api) => <CustomAlertFields vehicleId={vehicleId} alert={alert} {...api} />}
    </FormDialog>
  );
}

function initialMode(alert?: CustomAlertRecord): RepeatMode {
  if (alert?.repeatMonths) return "months";
  if (alert?.repeatKm) return "km";
  return "none";
}

function CustomAlertFields({ vehicleId, alert, close, setBusy }: { vehicleId: string; alert?: CustomAlertRecord } & FormDialogApi) {
  const router = useRouter();
  const dateRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [label, setLabel] = useState(alert?.label ?? "");
  const [mode, setMode] = useState<RepeatMode>(initialMode(alert));
  const [repeatMonths, setRepeatMonths] = useState<number | null>(alert?.repeatMonths ?? 12);
  const [repeatKm, setRepeatKm] = useState<number | null>(alert?.repeatKm ?? null);
  // Kept across mode switches, so hiding a field doesn't lose what was typed.
  const [dueKm, setDueKm] = useState<number | null>(alert?.dueKm ?? null);
  const [dueDate, setDueDate] = useState(alert?.dueDate?.slice(0, 10) ?? "");

  function applyPreset(name: string) {
    setLabel(name);
    setMode("months");
    setRepeatMonths(12);
    requestAnimationFrame(() => dateRef.current?.focus());
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    // A recurring alert follows only the dimension it repeats on; null (not undefined) clears the other.
    const payload = {
      label,
      dueKm: mode === "months" ? null : dueKm,
      dueDate: mode === "km" ? null : dueDate || null,
      repeatMonths: mode === "months" ? repeatMonths : null,
      repeatKm: mode === "km" ? repeatKm : null,
    };
    setPending(true);
    setBusy(true);
    try {
      const res = alert ? await updateCustomAlert(alert.id, payload) : await createCustomAlert(vehicleId, payload);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(alert ? "Alerta atualizado" : "Alerta criado");
      close();
      router.refresh();
    } finally {
      setPending(false);
      setBusy(false);
    }
  }

  const kmField = (
    <Field label={mode === "km" ? "Km" : "Km (opcional)"}>
      <IntegerInput suffix="km" required={mode === "km"} value={dueKm} onValueChange={setDueKm} />
    </Field>
  );
  const dateField = (
    <Field label={mode === "months" ? "Data" : "Data (opcional)"}>
      <Input ref={dateRef} type="date" required={mode === "months"} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
    </Field>
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div>
        <Field label="Descrição">
          <Input name="label" required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: IPVA, licenciamento, seguro" />
        </Field>
        {!alert && (
          <div role="group" aria-label="Atalhos anuais" className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <Chip key={p} selected={label === p && mode === "months" && repeatMonths === 12} disabled={pending} onClick={() => applyPreset(p)}>{p}</Chip>
            ))}
          </div>
        )}
      </div>

      <Field label="Repetir" group hint={repeatHint(mode, repeatMonths, repeatKm)}>
        <Segmented options={REPEAT_OPTIONS} value={mode} onChange={setMode} />
        {mode !== "none" && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="tabular-nums text-xs text-muted">a cada</span>
            <div className="w-36">
              {mode === "months" ? (
                <IntegerInput aria-label="Repetir a cada quantos meses" suffix={repeatMonths === 1 ? "mês" : "meses"} required
                  value={repeatMonths} onValueChange={setRepeatMonths} />
              ) : (
                <IntegerInput aria-label="Repetir a cada quantos km" suffix="km" required placeholder="10.000"
                  value={repeatKm} onValueChange={setRepeatKm} />
              )}
            </div>
            {mode === "months" && MONTH_CHOICES.map((c) => (
              <Chip key={c.months} selected={repeatMonths === c.months} disabled={pending} onClick={() => setRepeatMonths(c.months)}>{c.label}</Chip>
            ))}
          </div>
        )}
      </Field>

      {mode === "none" ? (
        <>
          <div className="grid grid-cols-2 gap-3">{kmField}{dateField}</div>
          <p className="tabular-nums text-[11px] text-muted">Informe pelo menos km ou data.</p>
        </>
      ) : (
        <div className="max-w-[calc(50%-0.375rem)]">{mode === "months" ? dateField : kmField}</div>
      )}
      <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
    </form>
  );
}

// What completing it will do, mirroring nextOccurrence.
function repeatHint(mode: RepeatMode, months: number | null, km: number | null): string | undefined {
  if (mode === "months") {
    if (!months) return "Informe o intervalo em meses.";
    return `Ao concluir, o próximo vence ${months === 1 ? "1 mês" : `${months} meses`} depois, no mesmo dia.`;
  }
  if (mode === "km") {
    if (!km) return "Informe o intervalo em km.";
    return `Ao concluir, o próximo vence ${km.toLocaleString("pt-BR")} km depois deste (ou do odômetro, se ele já passou).`;
  }
  return undefined;
}
