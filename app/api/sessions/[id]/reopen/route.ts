import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

/** Reopen a closed session — back to OPEN and clear the frozen cost snapshot. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;
  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) return NextResponse.json({ error: "ไม่พบรอบนี้" }, { status: 404 });
  if (session.status !== "CLOSED") {
    return NextResponse.json({ error: "รอบนี้ยังเปิดอยู่" }, { status: 400 });
  }

  const updated = await prisma.session.update({
    where: { id },
    data: {
      status: "OPEN",
      closedAt: null,
      courtCost: null,
      shuttlecockCost: null,
      totalCost: null,
    },
  });
  return NextResponse.json(updated);
}
