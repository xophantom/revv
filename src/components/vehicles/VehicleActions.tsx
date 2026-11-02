"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Pencil, Trash2 } from "lucide-react";
import { deleteVehicle } from "@/actions/vehicles";
import { Button, buttonClass } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { VehicleForm, type EditableVehicle } from "./VehicleForm";

export function VehicleActions({ vehicle }: { vehicle: EditableVehicle }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();

  async function onDelete() {
    const ok = await confirm({
      title: `Excluir "${vehicle.name}"?`,
      description: "Manutenções, upgrades, alertas e anexos dele também serão apagados. Não dá para desfazer.",
      confirmLabel: "Excluir veículo",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteVehicle(vehicle.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Veículo excluído");
      router.push("/garage");
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <VehicleForm vehicle={vehicle} trigger={<Button variant="outline" size="sm"><Pencil size={13} /> Editar</Button>} />
      <a href={`/api/vehicles/${vehicle.id}/pdf`} className={buttonClass({ variant: "outline", size: "sm" })}><Download size={13} /> PDF</a>
      <Button variant="outline" size="sm" onClick={onDelete} disabled={pending} className="hover:border-accent/60 hover:text-accent">
        <Trash2 size={13} /> {pending ? "Excluindo..." : "Excluir"}
      </Button>
      {confirmDialog}
    </div>
  );
}
