import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { paidBlockMessage } from "@/lib/costing";
import { COST_SIGNUP_INCLUDE, costAttendees } from "@/lib/costReport";

/** Mark a player's bill collected (paidAt) or clear it. Admin only — this is
 *  the money record the LINE "ค้างจ่าย" summary reads from. Ticking it needs the
 *  player's game finished and a checkout first (see paidBlockMessage);
 *  un-ticking is always allowed. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; signUpId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id, signUpId } = await params;
  const body = await req.json();
  const { paid } = body;

  const target = await prisma.signUp.findUnique({
    where: { id: signUpId },
    include: COST_SIGNUP_INCLUDE,
  });
  if (!target || target.sessionId !== id) {
    return NextResponse.json({ error: "ไม่พบรายชื่อนี้" }, { status: 404 });
  }

  if (paid) {
    const blocked = paidBlockMessage(costAttendees([target])[0]);
    if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });
  }

  const updated = await prisma.signUp.update({
    where: { id: signUpId },
    data: { paidAt: paid ? new Date() : null },
  });

  return NextResponse.json(updated);
}
