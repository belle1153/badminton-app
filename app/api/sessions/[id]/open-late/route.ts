import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

/** Toggle the 2-ทุ่ม courts open early (before the 20:00 auto-unlock). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const open = body.open !== false;

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) return NextResponse.json({ error: "ไม่พบรอบนี้" }, { status: 404 });

  const updated = await prisma.session.update({
    where: { id },
    data: { lateOpenedAt: open ? new Date() : null },
  });
  return NextResponse.json({ ok: true, lateOpenedAt: updated.lateOpenedAt });
}
