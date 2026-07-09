import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { signUpIdA, signUpIdB } = body;

  if (!signUpIdA || !signUpIdB || signUpIdA === signUpIdB) {
    return NextResponse.json({ error: "กรุณาเลือกผู้เล่น 2 คนที่ต่างกัน" }, { status: 400 });
  }

  const [a, b] = await Promise.all([
    prisma.signUp.findUnique({ where: { id: signUpIdA } }),
    prisma.signUp.findUnique({ where: { id: signUpIdB } }),
  ]);

  if (!a || !b || a.sessionId !== id || b.sessionId !== id) {
    return NextResponse.json({ error: "ไม่พบผู้เล่นนี้ในรอบนี้" }, { status: 404 });
  }
  if (a.status !== "CONFIRMED" || b.status !== "CONFIRMED") {
    return NextResponse.json({ error: "จับคู่ได้เฉพาะคนที่ยืนยันแล้ว" }, { status: 400 });
  }
  if (a.fixedPartnerId || b.fixedPartnerId) {
    return NextResponse.json({ error: "มีคนใดคนหนึ่งจับคู่อยู่แล้ว" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.signUp.update({ where: { id: a.id }, data: { fixedPartnerId: b.id } }),
    prisma.signUp.update({ where: { id: b.id }, data: { fixedPartnerId: a.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
