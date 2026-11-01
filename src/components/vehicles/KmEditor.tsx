"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateKm } from "@/actions/vehicles";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function KmEditor({ id, currentKm }: { id: string; currentKm: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(currentKm));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await updateKm(id, Number(value));
    setSaving(false);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Odômetro atualizado");
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="mono mt-4 text-xs text-muted">
      {editing ? (
        <div className="flex items-center gap-2">
          <span>ODÔMETRO</span>
          <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} className="w-28 py-1" />
          <span>km</span>
          <Button type="button" onClick={save} disabled={saving} className="bg-accent px-3 py-1 text-bg">{saving ? "..." : "salvar"}</Button>
          <button type="button" onClick={() => { setEditing(false); setValue(String(currentKm)); }} className="text-muted transition hover:text-fg">cancelar</button>
        </div>
      ) : (
        <span>
          ODÔMETRO <b className="text-fg">{currentKm.toLocaleString("pt-BR")}</b> km ·{" "}
          <button type="button" onClick={() => { setValue(String(currentKm)); setEditing(true); }} className="cursor-pointer text-accent transition hover:opacity-80">atualizar</button>
        </span>
      )}
    </div>
  );
}
