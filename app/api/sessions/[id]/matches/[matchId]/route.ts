import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

/** Delete one match — e.g. cancel a pre-queued game or remove a mistake. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id, matchId } = await params;
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || match.sessionId !== id) {
    return NextResponse.json({ error: "ไม่พบแมทช์นี้" }, { status: 404 });
  }

  await prisma.match.delete({ where: { id: matchId } });
  return NextResponse.json({ ok: true });
}
