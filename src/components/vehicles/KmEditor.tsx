"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Gauge } from "lucide-react";
import { updateKm } from "@/actions/vehicles";
import { IntegerInput } from "@/components/ui/masked-input";
import { Button } from "@/components/ui/button";

export function KmEditor({ id, currentKm }: { id: string; currentKm: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<number | null>(currentKm);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (value == null || saving) return;
    setSaving(true);
    const res = await updateKm(id, value);
    setSaving(false);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Odômetro atualizado");
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="tabular-nums mt-4 text-xs text-muted">
      {editing ? (
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); save(); }}
          onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }}>
          <Gauge size={14} aria-hidden />
          <IntegerInput aria-label="Odômetro" suffix="km" autoFocus value={value} onValueChange={setValue} className="h-8 w-36" />
          <Button type="submit" size="sm" disabled={saving || value == null}>{saving ? "Salvando..." : "Salvar"}</Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <Gauge size={14} aria-hidden />
          <span>ODÔMETRO <b className="text-sm text-fg">{currentKm.toLocaleString("pt-BR")}</b> km</span>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-accent hover:text-accent" onClick={() => { setValue(currentKm); setEditing(true); }}>Atualizar</Button>
        </div>
      )}
    </div>
  );
}
