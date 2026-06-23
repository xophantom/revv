import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { streamPrivateBlob } from "@/lib/blob";

export const runtime = "nodejs";

// Streams a vehicle's PRIVATE photo blob to its owner only.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const v = await db.vehicle.findUnique({ where: { id } });
  if (!v || v.userId !== session.user.id || !v.photoUrl) return new NextResponse("Not found", { status: 404 });

  return streamPrivateBlob(v.photoUrl, request.headers.get("if-none-match"));
}
