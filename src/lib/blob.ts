import { NextResponse } from "next/server";
import { get, del } from "@vercel/blob";

// For URLs whose bytes can never change (an attachment id, a photo URL pinned by `?v=<photoKey>`).
// `private` keeps them out of the CDN and shared caches, so every fetch that reaches a cache
// first went through the route's auth check in this same browser. A day, not a year: after
// signing out on a shared computer, the browser stops serving them without asking soon after.
export const CACHE_IMMUTABLE = "private, max-age=86400";
// Anything else revalidates each time; the ETag makes that a cheap 304.
export const CACHE_REVALIDATE = "private, no-cache";

// Streams a private Vercel Blob as an auth-gated Response, with conditional-request
// (ETag/304) support. Call ONLY after verifying the caller owns the resource.
export async function streamPrivateBlob(blobUrl: string, ifNoneMatch: string | null, cacheControl: string = CACHE_REVALIDATE): Promise<NextResponse> {
  const result = await get(blobUrl, { access: "private", ifNoneMatch: ifNoneMatch ?? undefined });
  if (!result) return new NextResponse("Not found", { status: 404 });

  // A 304 refreshes the stored entry's headers, so it carries the same policy as the 200.
  if (result.statusCode === 304) {
    return new NextResponse(null, { status: 304, headers: { ETag: result.blob.etag, "Cache-Control": cacheControl } });
  }

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType,
      "X-Content-Type-Options": "nosniff",
      ETag: result.blob.etag,
      "Cache-Control": cacheControl,
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
