import { z } from "zod";

// Files go browser → Vercel Blob, and the client hands back the URL. Accept only Blob's host,
// so the proxy routes never fetch (or delete) an arbitrary URL with the server token.
export const blobUrl = z.string().url().refine((u) => new URL(u).hostname.endsWith(".blob.vercel-storage.com"), "Anexo inválido");

export const attachmentInput = z.object({ url: blobUrl, key: z.string(), fileName: z.string(), mime: z.string(), size: z.number().int() });

export function attachmentRows(list: z.infer<typeof attachmentInput>[], vehicleId: string) {
  return list.map((a) => ({ ...a, vehicleId, kind: a.mime.includes("pdf") ? ("pdf" as const) : ("image" as const) }));
}
