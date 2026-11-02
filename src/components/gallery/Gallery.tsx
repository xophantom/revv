"use client";
import { useUi } from "@/store/ui";
import { Thumb } from "./Thumb";

export function Gallery({ images }: { images: { url: string; caption?: string | null }[] }) {
  const open = useUi((s) => s.openLightbox);
  if (!images.length) return <p className="text-sm text-muted">Sem fotos ainda. Adicione fotos nas manutenções e upgrades</p>;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      {images.map((img, i) => (
        <Thumb key={i} src={img.url} label={`foto ${i + 1}`} onClick={() => open(images, i)} className="aspect-square rounded-lg hover:opacity-80" />
      ))}
    </div>
  );
}
