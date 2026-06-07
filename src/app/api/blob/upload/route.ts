import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";

// Issues short-lived client-upload tokens. The browser hits this, gets a token,
// then uploads straight to Vercel Blob. Auth is enforced before a token is granted.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await auth();
        if (!session?.user?.id) throw new Error("Unauthorized");
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"],
          maximumSizeInBytes: 16 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.user.id }),
        };
      },
      onUploadCompleted: async () => {
        // No-op: the attachment row is written by the create action with the returned url.
      },
    });
    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "upload error" }, { status: 400 });
  }
}
