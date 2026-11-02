import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { VehicleForm } from "@/components/vehicles/VehicleForm";

export default async function GaragePage() {
  const user = await requireUser();
  const vehicles = await db.vehicle.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Garagem</h1>
        <VehicleForm />
      </div>
      {vehicles.length === 0 ? (
        <p className="mono text-sm text-muted">{"// nenhum veículo ainda: adicione o primeiro"}</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v, i) => <VehicleCard key={v.id} v={v} i={i} />)}
        </div>
      )}
    </div>
  );
}
