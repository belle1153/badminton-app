import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { signUpId } = body;

  const target = await prisma.signUp.findUnique({ where: { id: signUpId } });
  if (!target || target.sessionId !== id) {
    return NextResponse.json({ error: "ไม่พบผู้เล่นนี้ในรอบนี้" }, { status: 404 });
  }
  if (!target.fixedPartnerId) {
    return NextResponse.json({ ok: true });
  }

  await prisma.$transaction([
    prisma.signUp.update({ where: { id: target.id }, data: { fixedPartnerId: null } }),
    prisma.signUp.update({ where: { id: target.fixedPartnerId }, data: { fixedPartnerId: null } }),
  ]);

  return NextResponse.json({ ok: true });
}
