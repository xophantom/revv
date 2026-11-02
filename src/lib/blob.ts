import { NextResponse } from "next/server";
import { get, del } from "@vercel/blob";

// Streams a private Vercel Blob as an auth-gated Response, with conditional-request
// (ETag/304) support. Call ONLY after verifying the caller owns the resource.
export async function streamPrivateBlob(blobUrl: string, ifNoneMatch: string | null): Promise<NextResponse> {
  const result = await get(blobUrl, { access: "private", ifNoneMatch: ifNoneMatch ?? undefined });
  if (!result) return new NextResponse("Not found", { status: 404 });

  if (result.statusCode === 304) {
    return new NextResponse(null, { status: 304, headers: { ETag: result.blob.etag, "Cache-Control": "private, no-cache" } });
  }

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType,
      "X-Content-Type-Options": "nosniff",
      ETag: result.blob.etag,
      "Cache-Control": "private, no-cache",
    },
  });
}

// Best effort: the rows are already gone, so a storage hiccup must not fail the user's action.
export async function deleteBlobs(urls: (string | null | undefined)[]): Promise<void> {
  const list = urls.filter((u): u is string => Boolean(u));
  if (!list.length) return;
  try {
    await del(list);
  } catch (e) {
    console.error("[blob] delete failed", e);
  }
}
