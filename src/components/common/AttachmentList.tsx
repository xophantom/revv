"use client";
import { FileText } from "lucide-react";
import { useUi } from "@/store/ui";
import { Thumb } from "@/components/gallery/Thumb";

type Att = { id: string; kind: "image" | "pdf"; url: string; fileName: string; caption?: string | null };

export function AttachmentList({ attachments }: { attachments: Att[] }) {
  if (!attachments.length) return null;
  const images = attachments.filter((a) => a.kind === "image");
  const pdfs = attachments.filter((a) => a.kind === "pdf");
  const lightboxImages = images.map((a) => ({ url: a.url, caption: a.caption }));
  return (
    <div className="flex flex-wrap items-center gap-2">
      {images.map((a, i) => (
        <Thumb
          key={a.id}
          src={a.url}
          label={a.caption ?? a.fileName}
          onClick={() => useUi.getState().openLightbox(lightboxImages, i)}
          className="h-11 w-11 rounded-md hover:border-accent"
        />
      ))}
      {pdfs.map((a) => (
        <a
          key={a.id}
          href={a.url}
          target="_blank"
          rel="noreferrer"
          className="tabular-nums flex items-center gap-1 text-xs text-muted transition hover:text-accent"
        >
          <FileText size={13} aria-hidden className="shrink-0" />
          {a.fileName}
        </a>
      ))}
    </div>
  );
}
