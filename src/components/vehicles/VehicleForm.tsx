"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createVehicle } from "@/actions/vehicles";
import { AttachmentUploader } from "@/components/common/AttachmentUploader";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function VehicleForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<{ url: string; key: string } | null>(null);
  async function action(formData: FormData) {
    const raw = Object.fromEntries(formData.entries());
    const res = await createVehicle({ ...raw, photoUrl: photo?.url, photoKey: photo?.key });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Veículo criado");
    setOpen(false); setPhoto(null); router.refresh();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="bg-accent text-bg">+ Veículo</Button></DialogTrigger>
      <DialogContent className="glass">
        <DialogHeader><DialogTitle>Novo veículo</DialogTitle></DialogHeader>
        <form action={action} className="grid gap-3">
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
            <div><Label>Km atual</Label><Input name="currentKm" type="number" defaultValue={0} /></div>
          </div>
          <AttachmentUploader label="Foto do veículo" onUploaded={(f) => f[0] && setPhoto({ url: f[0].url, key: f[0].key })} />
          <Button type="submit" className="bg-accent text-bg">Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
