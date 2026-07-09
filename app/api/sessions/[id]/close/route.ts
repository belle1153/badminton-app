import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { courtRateId, courtHours, shuttlecockTypeId, shuttlecockQty } = body;

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "ไม่พบรอบนี้" }, { status: 404 });
  }
  if (session.status === "CLOSED") {
    return NextResponse.json({ error: "รอบนี้ปิดไปแล้ว" }, { status: 400 });
  }

  const [courtRate, shuttlecockType] = await Promise.all([
    prisma.courtRate.findUnique({ where: { id: courtRateId } }),
    prisma.shuttlecockType.findUnique({ where: { id: shuttlecockTypeId } }),
  ]);

  if (!courtRate || !shuttlecockType) {
    return NextResponse.json({ error: "ข้อมูลค่าคอร์ท/ลูกแบดไม่ถูกต้อง" }, { status: 400 });
  }

  const hours = Number(courtHours);
  const qty = Number(shuttlecockQty);
  if (!Number.isFinite(hours) || hours < 0 || !Number.isFinite(qty) || qty < 0) {
    return NextResponse.json({ error: "จำนวนไม่ถูกต้อง" }, { status: 400 });
  }

  const courtCost = Math.round(courtRate.pricePerHour * hours);
  const shuttlecockCost = Math.round(shuttlecockType.pricePerPiece * qty);
  const totalCost = courtCost + shuttlecockCost;

  const updated = await prisma.session.update({
    where: { id },
    data: {
      courtRateId,
      courtHours: hours,
      shuttlecockTypeId,
      shuttlecockQty: qty,
      courtCost,
      shuttlecockCost,
      totalCost,
      status: "CLOSED",
      closedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
}
