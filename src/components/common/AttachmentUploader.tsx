"use client";
import { useState } from "react";
import { useUploadThing } from "@/lib/uploadthing";

export type Uploaded = { url: string; key: string; fileName: string; mime: string; size: number };

export function AttachmentUploader({ onUploaded, label = "Anexar fotos/PDF" }: { onUploaded: (files: Uploaded[]) => void; label?: string }) {
  const [busy, setBusy] = useState(false);
  const { startUpload } = useUploadThing("recordUpload", {
    onClientUploadComplete: (res) => {
      setBusy(false);
      onUploaded((res ?? []).map((r) => ({ url: r.serverData.url, key: r.serverData.key, fileName: r.serverData.name, mime: r.serverData.type, size: r.serverData.size })));
    },
    onUploadError: () => setBusy(false),
  });
  return (
    <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-border py-4 text-sm text-muted transition hover:text-fg">
      {busy ? "Enviando..." : label}
      <input type="file" multiple accept="image/*,application/pdf" className="hidden"
        onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) { setBusy(true); startUpload(fs); } }} />
    </label>
  );
}
