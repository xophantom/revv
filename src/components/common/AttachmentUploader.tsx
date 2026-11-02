"use client";
import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type Uploaded = { url: string; key: string; fileName: string; mime: string; size: number };

export function AttachmentUploader({ onUploaded, onBusyChange, disabled = false, label = "Anexar fotos/PDF", accept = "image/*,application/pdf", multiple = true }: {
  onUploaded: (files: Uploaded[]) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
  label?: string;
  accept?: string;
  multiple?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  // Closing the dialog unmounts the uploader; an upload that resolves afterwards
  // must not leak into the parent's state (and so into the next opening).
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  async function handleFiles(files: File[]) {
    setBusy(true);
    onBusyChange?.(true);
    try {
      const uploaded: Uploaded[] = [];
      for (const file of files) {
        // Browser → Vercel Blob directly (bypasses the serverless body limit).
        // The token route adds a random suffix, so same-named files don't collide.
        const blob = await upload(file.name, file, { access: "private", handleUploadUrl: "/api/blob/upload" });
        uploaded.push({ url: blob.url, key: blob.pathname, fileName: file.name, mime: file.type, size: file.size });
      }
      if (alive.current) onUploaded(uploaded);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setBusy(false);
      if (alive.current) onBusyChange?.(false);
    }
  }

  const off = busy || disabled;
  return (
    <label className={cn(
      "flex items-center justify-center rounded-lg border border-dashed border-border py-4 text-sm text-muted transition",
      busy ? "cursor-wait" : disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:text-fg",
    )}>
      {busy ? "Enviando..." : label}
      <input type="file" multiple={multiple} accept={accept} className="hidden" disabled={off}
        onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) handleFiles(fs); e.target.value = ""; }} />
    </label>
  );
}

// Lists new uploads and, when editing, the files already saved (anything with a key and a name).
export function UploadedFiles<F extends { key: string; fileName: string }>({ files, onRemove, prefix = "", disabled = false }: {
  files: F[];
  onRemove: (file: F) => void;
  prefix?: string;
  disabled?: boolean;
}) {
  if (!files.length) return null;
  return (
    <ul className="mt-2 grid gap-1">
      {files.map((f) => (
        <li key={f.key} className="mono flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1 text-xs text-muted">
          <span className="min-w-0 truncate">{prefix}{f.fileName}</span>
          <button type="button" onClick={() => onRemove(f)} disabled={disabled} aria-label={`Remover ${f.fileName}`}
            className="shrink-0 transition hover:text-accent disabled:opacity-50">✕</button>
        </li>
      ))}
    </ul>
  );
}
