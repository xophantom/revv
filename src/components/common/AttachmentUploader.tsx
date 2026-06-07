"use client";
import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";

export type Uploaded = { url: string; key: string; fileName: string; mime: string; size: number };

export function AttachmentUploader({ onUploaded, label = "Anexar fotos/PDF" }: { onUploaded: (files: Uploaded[]) => void; label?: string }) {
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: File[]) {
    setBusy(true);
    try {
      const uploaded: Uploaded[] = [];
      for (const file of files) {
        // Browser → Vercel Blob directly (bypasses the serverless body limit).
        // The token route adds a random suffix, so same-named files don't collide.
        const blob = await upload(file.name, file, { access: "public", handleUploadUrl: "/api/blob/upload" });
        uploaded.push({ url: blob.url, key: blob.pathname, fileName: file.name, mime: file.type, size: file.size });
      }
      onUploaded(uploaded);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-border py-4 text-sm text-muted transition hover:text-fg">
      {busy ? "Enviando..." : label}
      <input type="file" multiple accept="image/*,application/pdf" className="hidden"
        onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) handleFiles(fs); e.target.value = ""; }} />
    </label>
  );
}
