import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { closed } = body;

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "ไม่พบรอบนี้" }, { status: 404 });
  }
  if (session.status === "CLOSED") {
    return NextResponse.json({ error: "รอบนี้ปิดวันไปแล้ว" }, { status: 400 });
  }

  const updated = await prisma.session.update({
    where: { id },
    data: { registrationClosedAt: closed ? new Date() : null },
  });

  return NextResponse.json(updated);
}
