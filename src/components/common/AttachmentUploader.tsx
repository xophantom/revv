"use client";
import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { LoaderCircle, Upload, X } from "lucide-react";
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
  const [dragging, setDragging] = useState(false);
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
  // Drops are filtered by `accept` like the picker does (the browser doesn't filter them).
  function accepts(f: File) {
    return accept.split(",").some((rule) => {
      const r = rule.trim();
      return r.endsWith("/*") ? f.type.startsWith(r.slice(0, -1)) : f.type === r;
    });
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (off) return;
    const all = Array.from(e.dataTransfer.files);
    const typed = all.filter(accepts);
    const fs = multiple ? typed : typed.slice(0, 1);
    if (typed.length < all.length) toast.error(typed.length ? "Alguns arquivos foram ignorados (tipo não aceito)" : "Tipo de arquivo não aceito");
    else if (fs.length < typed.length) toast.error("Aqui vai um arquivo só: usei o primeiro");
    if (fs.length) handleFiles(fs);
  }
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); if (!off) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg border border-dashed py-4 text-sm text-muted transition focus-within:border-accent",
        dragging ? "border-accent bg-accent/5 text-accent" : "border-border",
        busy ? "cursor-wait" : disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-white/25 hover:text-fg",
      )}>
      {busy ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Upload size={15} aria-hidden />}
      {busy ? "Enviando..." : dragging ? "Solte para anexar" : label}
      <input type="file" multiple={multiple} accept={accept} className="sr-only" disabled={off}
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
            className="-m-1 shrink-0 cursor-pointer rounded p-1 transition hover:text-accent disabled:opacity-50"><X size={13} /></button>
        </li>
      ))}
    </ul>
  );
}
