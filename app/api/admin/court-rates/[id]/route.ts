import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }
  const { id } = await params;
  try {
    await prisma.courtRate.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "ลบไม่ได้ เพราะมีรอบเล่นใช้ราคานี้อยู่" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
