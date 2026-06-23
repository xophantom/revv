import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { streamPrivateBlob } from "@/lib/blob";

export const runtime = "nodejs";

// Streams a PRIVATE attachment blob to its owner only. Auth + ownership are checked
// right next to the blob fetch (never via middleware/CDN) so content can't leak.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const att = await db.attachment.findUnique({ where: { id }, include: { vehicle: true } });
  if (!att || att.vehicle.userId !== session.user.id) return new NextResponse("Not found", { status: 404 });

  return streamPrivateBlob(att.url, request.headers.get("if-none-match"));
}
