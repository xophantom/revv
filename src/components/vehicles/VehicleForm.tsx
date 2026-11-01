"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createVehicle } from "@/actions/vehicles";
import { AttachmentUploader, UploadedFiles, type Uploaded } from "@/components/common/AttachmentUploader";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function VehicleForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<Uploaded | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);

  function reset() { setPhoto(null); setUploading(false); }
  // Esc/outside click can't close the dialog mid-save; the save's completion closes it.
  function onOpenChange(next: boolean) {
    if (!next && pending) return;
    setOpen(next);
    if (!next) reset();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || uploading) return;
    // Drop blank fields so optional numbers (year) don't coerce "" -> 0 and
    // optional strings (plate, ...) store undefined instead of "".
    const raw = Object.fromEntries([...new FormData(e.currentTarget).entries()].filter(([, v]) => v !== ""));
    setPending(true);
    try {
      const res = await createVehicle({ ...raw, photoUrl: photo?.url, photoKey: photo?.key });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Veículo criado");
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild><Button className="bg-accent text-bg">+ Veículo</Button></DialogTrigger>
      <DialogContent className="glass">
        <DialogHeader><DialogTitle>Novo veículo</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3">
          <div><Label>Nome</Label><Input name="name" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Placa</Label><Input name="plate" /></div>
            <div><Label>Ano</Label><Input name="year" type="number" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Marca</Label><Input name="make" /></div>
            <div><Label>Modelo</Label><Input name="model" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Motor</Label><Input name="engine" /></div>
            <div><Label>Km atual</Label><Input name="currentKm" type="number" inputMode="numeric" defaultValue={0} /></div>
          </div>
          <div>
            <AttachmentUploader label="Foto do veículo" disabled={pending} onBusyChange={setUploading}
              onUploaded={(f) => f[0] && setPhoto(f[0])} />
            <UploadedFiles files={photo ? [photo] : []} prefix="Foto: " disabled={pending} onRemove={() => setPhoto(null)} />
          </div>
          <Button type="submit" disabled={pending || uploading} className="bg-accent text-bg">
            {pending ? "Salvando..." : uploading ? "Aguardando upload..." : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
