export const runtime = "nodejs";
import { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { VehicleReport } from "@/lib/pdf/VehicleReport";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const v = await db.vehicle.findUnique({
    where: { id },
    include: { spec: true, maintenances: { orderBy: { date: "desc" } }, upgrades: { orderBy: { date: "desc" } }, fuelRecords: true },
  });
  if (!v || v.userId !== user.id) return new Response("Not found", { status: 404 });
  const buffer = await renderToBuffer(<VehicleReport vehicle={v} />);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="revv-${v.name.replace(/[^a-z0-9]+/gi, "-")}.pdf"`,
    },
  });
}
