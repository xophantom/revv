"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createVehicle, updateVehicle } from "@/actions/vehicles";
import { AttachmentUploader, UploadedFiles, type Uploaded } from "@/components/common/AttachmentUploader";
import { FormDialog, type FormDialogApi } from "@/components/common/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type EditableVehicle = {
  id: string;
  name: string;
  plate: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  engine: string | null;
  color: string | null;
  currentKm: number;
  photoUrl: string | null;
};

export function VehicleForm({ vehicle, trigger }: { vehicle?: EditableVehicle; trigger?: React.ReactNode }) {
  return (
    <FormDialog title={vehicle ? "Editar veículo" : "Novo veículo"} trigger={trigger ?? <Button className="bg-accent text-bg">+ Veículo</Button>}>
      {(api) => <VehicleFields vehicle={vehicle} {...api} />}
    </FormDialog>
  );
}

function VehicleFields({ vehicle, close, setBusy }: { vehicle?: EditableVehicle } & FormDialogApi) {
  const router = useRouter();
  const [photo, setPhoto] = useState<Uploaded | null>(null);
  const [keepPhoto, setKeepPhoto] = useState(Boolean(vehicle?.photoUrl));
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || uploading) return;
    // Blank fields go as "" and the action stores null, so editing can clear them.
    const fields = Object.fromEntries(new FormData(e.currentTarget).entries());
    // A new upload replaces the photo, ✕ on the current one removes it, otherwise it stays.
    const photoFields = photo ? { photoUrl: photo.url, photoKey: photo.key } : keepPhoto ? {} : { photoUrl: null, photoKey: null };
    setPending(true);
    setBusy(true);
    try {
      if (vehicle) {
        const res = await updateVehicle(vehicle.id, { ...fields, ...photoFields });
        if (!res.ok) { toast.error(res.error); return; }
        toast.success("Veículo atualizado");
        close();
        router.refresh();
      } else {
        const res = await createVehicle({ ...fields, ...photoFields });
        if (!res.ok) { toast.error(res.error); return; }
        toast.success("Veículo criado");
        close();
        router.push(`/garage/${res.data.id}`); // next step is the spec sheet and the history
      }
    } finally {
      setPending(false);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div><Label>Nome</Label><Input name="name" required defaultValue={vehicle?.name} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Placa</Label><Input name="plate" defaultValue={vehicle?.plate ?? ""} /></div>
        <div><Label>Ano</Label><Input name="year" type="number" defaultValue={vehicle?.year ?? ""} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Marca</Label><Input name="make" defaultValue={vehicle?.make ?? ""} /></div>
        <div><Label>Modelo</Label><Input name="model" defaultValue={vehicle?.model ?? ""} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Motor</Label><Input name="engine" defaultValue={vehicle?.engine ?? ""} /></div>
        <div><Label>Cor</Label><Input name="color" defaultValue={vehicle?.color ?? ""} /></div>
      </div>
      <div><Label>Km atual</Label><Input name="currentKm" type="number" inputMode="numeric" required={Boolean(vehicle)} defaultValue={vehicle?.currentKm ?? 0} /></div>
      <div>
        <AttachmentUploader label={vehicle?.photoUrl ? "Trocar foto" : "Foto do veículo"} accept="image/*" multiple={false}
          disabled={pending} onBusyChange={setUploading}
          onUploaded={(f) => { if (f[0]) { setPhoto(f[0]); setKeepPhoto(false); } }} />
        <UploadedFiles files={photo ? [{ key: photo.key, fileName: photo.fileName }] : keepPhoto ? [{ key: "current", fileName: "foto atual" }] : []} prefix="Foto: " disabled={pending}
          onRemove={() => { setPhoto(null); setKeepPhoto(false); }} />
      </div>
      <Button type="submit" disabled={pending || uploading} className="bg-accent text-bg">
        {pending ? "Salvando..." : uploading ? "Aguardando upload..." : "Salvar"}
      </Button>
    </form>
  );
}
