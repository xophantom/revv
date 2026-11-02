"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createVehicle, updateVehicle } from "@/actions/vehicles";
import { AttachmentUploader, UploadedFiles, type Uploaded } from "@/components/common/AttachmentUploader";
import { FormDialog, type FormDialogApi } from "@/components/common/FormDialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { IntegerInput, PlateInput } from "@/components/ui/masked-input";

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
    <FormDialog title={vehicle ? "Editar veículo" : "Novo veículo"} trigger={trigger ?? <Button><Plus size={16} /> Veículo</Button>}>
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
      <Field label="Nome"><Input name="name" required defaultValue={vehicle?.name} placeholder="Ex.: Civic do dia a dia" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Placa"><PlateInput name="plate" defaultValue={vehicle?.plate ?? ""} placeholder="ABC1D23" /></Field>
        <Field label="Ano"><Input name="year" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" title="Ano com 4 dígitos" defaultValue={vehicle?.year ?? ""} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Marca"><Input name="make" defaultValue={vehicle?.make ?? ""} /></Field>
        <Field label="Modelo"><Input name="model" defaultValue={vehicle?.model ?? ""} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Motor"><Input name="engine" defaultValue={vehicle?.engine ?? ""} placeholder="Ex.: 2.0 16V" /></Field>
        <Field label="Cor"><Input name="color" defaultValue={vehicle?.color ?? ""} /></Field>
      </div>
      <Field label="Km atual"><IntegerInput name="currentKm" suffix="km" required={Boolean(vehicle)} defaultValue={vehicle?.currentKm ?? null} placeholder="0" /></Field>
      <div>
        <AttachmentUploader label={vehicle?.photoUrl ? "Trocar foto" : "Foto do veículo"} accept="image/*" multiple={false}
          disabled={pending} onBusyChange={setUploading}
          onUploaded={(f) => { if (f[0]) { setPhoto(f[0]); setKeepPhoto(false); } }} />
        <UploadedFiles files={photo ? [{ key: photo.key, fileName: photo.fileName }] : keepPhoto ? [{ key: "current", fileName: "foto atual" }] : []} prefix="Foto: " disabled={pending}
          onRemove={() => { setPhoto(null); setKeepPhoto(false); }} />
      </div>
      <Button type="submit" disabled={pending || uploading}>
        {pending ? "Salvando..." : uploading ? "Aguardando upload..." : "Salvar"}
      </Button>
    </form>
  );
}
