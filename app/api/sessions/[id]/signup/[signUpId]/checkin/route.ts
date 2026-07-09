import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; signUpId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id, signUpId } = await params;
  const body = await req.json();
  const { checkedIn } = body;

  const target = await prisma.signUp.findUnique({ where: { id: signUpId } });
  if (!target || target.sessionId !== id || target.status === "WITHDRAWN") {
    return NextResponse.json({ error: "ไม่พบรายชื่อนี้" }, { status: 404 });
  }

  const updated = await prisma.signUp.update({
    where: { id: signUpId },
    data: { checkedInAt: checkedIn ? new Date() : null },
  });

  return NextResponse.json(updated);
}
