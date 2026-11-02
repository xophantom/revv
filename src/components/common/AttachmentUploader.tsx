"use client";
import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { LoaderCircle, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type Uploaded = { url: string; key: string; fileName: string; mime: string; size: number };

// Phone photos run 3–12 MB, yet the app never shows them larger than the lightbox. Capping the
// long edge and re-encoding cuts the upload and every later download of the file.
const MAX_EDGE = 2048;
const QUALITY = 0.85;
// Anything else goes up untouched: PDFs, GIFs (animation), SVGs (vector), formats a browser may not decode.
const RESIZABLE = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXTENSION: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg" };

let webpEncodable: boolean | undefined;
// Safari's canvas can't encode WebP and silently hands back a PNG instead.
function canEncodeWebp(): boolean {
  if (webpEncodable === undefined) {
    const probe = document.createElement("canvas");
    probe.width = probe.height = 1;
    webpEncodable = probe.toDataURL("image/webp").startsWith("data:image/webp");
  }
  return webpEncodable;
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

// Both paths apply the EXIF rotation, so phone photos don't come out sideways.
async function decodeImage(file: File): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    // Older Safari rejects the option; an <img> honors EXIF and drawImage keeps it.
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } finally {
      URL.revokeObjectURL(url);
    }
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => {} };
  }
}

function renamed(file: File, type: string): string {
  if (file.type === type) return file.name;
  const dot = file.name.lastIndexOf(".");
  return `${dot > 0 ? file.name.slice(0, dot) : file.name}.${EXTENSION[type]}`;
}

// A downscaled re-encode of the image, or the original file whenever that wouldn't be smaller.
async function shrinkImage(file: File): Promise<File> {
  if (!RESIZABLE.has(file.type)) return file;
  let decoded: Decoded | undefined;
  const canvas = document.createElement("canvas");
  try {
    decoded = await decodeImage(file);
    if (!decoded.width || !decoded.height) return file;
    const scale = Math.min(1, MAX_EDGE / Math.max(decoded.width, decoded.height));
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    const type = canEncodeWebp() ? "image/webp" : "image/jpeg";
    if (type === "image/jpeg") {
      ctx.fillStyle = "#fff"; // no alpha in JPEG: transparent PNG areas would turn black
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));
    if (!blob || blob.type !== type || blob.size >= file.size) return file;
    return new File([blob], renamed(file, type), { type, lastModified: file.lastModified });
  } catch {
    return file; // this browser can't decode it: upload the original, as before
  } finally {
    decoded?.release();
    canvas.width = canvas.height = 0; // iOS caps total canvas memory; free it before the next file
  }
}

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
      for (const original of files) {
        const file = await shrinkImage(original);
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
