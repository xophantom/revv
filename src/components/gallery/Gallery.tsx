"use client";
import { useUi } from "@/store/ui";
export function Gallery({ images }: { images: { url: string; caption?: string | null }[] }) {
  const open = useUi((s) => s.openLightbox);
  if (!images.length) return <p className="mono text-sm text-muted">{"// sem fotos ainda: adicione fotos nas manutenções e upgrades"}</p>;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      {images.map((img, i) => (
        <button key={i} onClick={() => open(images, i)} className="aspect-square overflow-hidden rounded-lg border border-border bg-surface2 bg-cover bg-center transition hover:opacity-80" style={{ backgroundImage: `url(${img.url})` }} aria-label={`foto ${i + 1}`} />
      ))}
    </div>
  );
}
