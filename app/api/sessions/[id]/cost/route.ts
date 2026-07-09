import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const totalCost = Number(body.totalCost);
  if (!Number.isFinite(totalCost) || totalCost < 0) {
    return NextResponse.json({ error: "จำนวนเงินไม่ถูกต้อง" }, { status: 400 });
  }

  const session = await prisma.session.update({
    where: { id },
    data: { totalCost },
  });

  return NextResponse.json(session);
}
