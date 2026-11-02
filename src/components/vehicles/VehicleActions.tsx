"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteVehicle } from "@/actions/vehicles";
import { cn } from "@/lib/utils";
import { VehicleForm, type EditableVehicle } from "./VehicleForm";

const action = "mono rounded border border-border px-2 py-1 text-xs text-muted transition hover:text-fg disabled:opacity-50";

export function VehicleActions({ vehicle }: { vehicle: EditableVehicle }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!window.confirm(`Excluir "${vehicle.name}"? Manutenções, upgrades, alertas e anexos dele também serão apagados. Não dá para desfazer.`)) return;
    startTransition(async () => {
      const res = await deleteVehicle(vehicle.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Veículo excluído");
      router.push("/garage");
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <VehicleForm vehicle={vehicle} trigger={<button type="button" className={action}>Editar</button>} />
      <a href={`/api/vehicles/${vehicle.id}/pdf`} className={action}>Exportar PDF</a>
      <button type="button" onClick={onDelete} disabled={pending} className={cn(action, "hover:border-accent hover:text-accent")}>
        {pending ? "Excluindo..." : "Excluir"}
      </button>
    </div>
  );
}
