import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { vehicleSpecSchema, emptySpec } from "@/domain/spec-schema";
import { SpecEditForm } from "@/components/spec/SpecEditForm";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const user = await requireUser();
  const v = await db.vehicle.findUnique({ where: { id }, select: { name: true, userId: true } });
  return { title: v && v.userId === user.id ? `Ficha · ${v.name}` : "Ficha" };
}

export default async function SpecEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const v = await db.vehicle.findUnique({ where: { id }, include: { spec: true } });
  if (!v || v.userId !== user.id) notFound();
  const spec = v.spec ? vehicleSpecSchema.parse(v.spec.data) : emptySpec();
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Ficha de troca · {v.name}</h1>
        <Link href={`/garage/${id}`} className="text-sm text-accent transition hover:opacity-80">← voltar</Link>
      </div>
      <SpecEditForm vehicleId={id} initial={spec} />
    </div>
  );
}
