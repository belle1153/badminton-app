import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { promoteAfterWithdrawal } from "@/lib/signup";
import { isAdmin } from "@/lib/adminAuth";
import { selfWithdrawAllowed } from "@/lib/withdrawPolicy";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; signUpId: string }> }
) {
  const { id, signUpId } = await params;

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "ไม่พบรอบนี้" }, { status: 404 });
  }
  if (session.status === "CLOSED") {
    return NextResponse.json({ error: "รอบนี้ปิดแล้ว ไม่สามารถถอนชื่อได้" }, { status: 400 });
  }
  if (!(await isAdmin()) && !selfWithdrawAllowed(session.date)) {
    return NextResponse.json(
      { error: "เลยเวลาถอนชื่อด้วยตัวเอง (เที่ยงวันตี) แล้ว — แจ้งแอดมินให้ถอนให้ครับ" },
      { status: 400 }
    );
  }

  const target = await prisma.signUp.findUnique({ where: { id: signUpId } });
  if (!target || target.sessionId !== id || target.status === "WITHDRAWN") {
    return NextResponse.json({ error: "ไม่พบรายชื่อนี้" }, { status: 404 });
  }

  if (target.fixedPartnerId) {
    await prisma.signUp.update({
      where: { id: target.fixedPartnerId },
      data: { fixedPartnerId: null },
    });
  }

  await prisma.signUp.update({
    where: { id: signUpId },
    data: { status: "WITHDRAWN", slotNumber: null, fixedPartnerId: null },
  });

  const remaining = await prisma.signUp.findMany({
    where: { sessionId: id, status: { not: "WITHDRAWN" } },
  });

  const promotion = promoteAfterWithdrawal(remaining);
  if (promotion) {
    await prisma.signUp.update({
      where: { id: promotion.promoteId },
      data: { status: "CONFIRMED", slotNumber: promotion.slotNumber },
    });
  }

  return NextResponse.json({ ok: true, promoted: promotion });
}
