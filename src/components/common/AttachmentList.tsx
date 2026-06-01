"use client";
import { useUi } from "@/store/ui";

type Att = { id: string; kind: "image" | "pdf"; url: string; fileName: string; caption?: string | null };

export function AttachmentList({ attachments }: { attachments: Att[] }) {
  if (!attachments.length) return null;
  const images = attachments.filter((a) => a.kind === "image");
  const pdfs = attachments.filter((a) => a.kind === "pdf");
  const lightboxImages = images.map((a) => ({ url: a.url, caption: a.caption }));
  return (
    <div className="flex flex-wrap items-center gap-2">
      {images.map((a, i) => (
        <button
          key={a.id}
          type="button"
          aria-label={a.caption ?? a.fileName}
          onClick={() => useUi.getState().openLightbox(lightboxImages, i)}
          className="h-11 w-11 rounded-md border border-border bg-surface2 bg-cover bg-center transition hover:border-accent"
          style={{ backgroundImage: `url(${a.url})` }}
        />
      ))}
      {pdfs.map((a) => (
        <a
          key={a.id}
          href={a.url}
          target="_blank"
          rel="noreferrer"
          className="mono flex items-center gap-1 text-xs text-muted transition hover:text-accent"
        >
          <span>📄</span>
          {a.fileName}
        </a>
      ))}
    </div>
  );
}
