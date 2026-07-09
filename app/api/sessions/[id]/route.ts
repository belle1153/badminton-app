import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.session.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "ไม่พบรอบเล่นนี้" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
