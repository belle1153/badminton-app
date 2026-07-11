import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rebalanceSession } from "@/lib/seating";
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

  // Recompute seats so a vacated 1 ทุ่ม pulls up the earliest person who wanted
  // it (possibly moving them out of 2 ทุ่ม), cascading the freed 2 ทุ่ม seat to
  // the next reserve. Frozen once registration is soft-closed.
  if (session.registrationClosedAt == null) {
    await rebalanceSession(session);
  }

  return NextResponse.json({ ok: true });
}
