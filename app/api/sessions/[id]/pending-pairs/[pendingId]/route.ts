import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

/** Cancel a คู่เตรียม the admin no longer wants (e.g. picked the wrong people). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; pendingId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id, pendingId } = await params;
  const pending = await prisma.pendingPair.findUnique({ where: { id: pendingId } });
  if (!pending || pending.sessionId !== id) {
    return NextResponse.json({ error: "ไม่พบคู่เตรียมนี้" }, { status: 404 });
  }

  await prisma.pendingPair.delete({ where: { id: pendingId } });
  return NextResponse.json({ ok: true });
}
