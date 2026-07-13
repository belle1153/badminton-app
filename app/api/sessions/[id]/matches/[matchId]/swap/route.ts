import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id, matchId } = await params;
  const body = await req.json();
  const { outSignUpId, inSignUpId } = body;

  if (!outSignUpId || !inSignUpId) {
    return NextResponse.json({ error: "กรุณาเลือกคนที่จะสลับ" }, { status: 400 });
  }
  if (outSignUpId === inSignUpId) {
    return NextResponse.json({ error: "เลือกคนใหม่ที่ไม่ใช่คนเดิม" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "ไม่พบรอบนี้" }, { status: 404 });
  }
  if (session.status === "CLOSED") {
    return NextResponse.json({ error: "รอบนี้ปิดแล้ว" }, { status: 400 });
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { players: true },
  });
  if (!match || match.sessionId !== id) {
    return NextResponse.json({ error: "ไม่พบแมทช์นี้" }, { status: 404 });
  }

  const outPlayer = match.players.find((p) => p.signUpId === outSignUpId);
  if (!outPlayer) {
    return NextResponse.json({ error: "ไม่พบคนที่จะสลับในแมทช์นี้" }, { status: 404 });
  }

  const inSignUp = await prisma.signUp.findUnique({ where: { id: inSignUpId } });
  const eligible =
    inSignUp &&
    inSignUp.sessionId === id &&
    (inSignUp.status === "CONFIRMED" ||
      (inSignUp.status === "WAITLIST" && inSignUp.checkedInAt != null));
  if (!eligible) {
    return NextResponse.json(
      { error: "คนที่เลือกมาแทนไม่ถูกต้อง (ตัวสำรองต้องเช็คอินก่อน)" },
      { status: 400 }
    );
  }

  // Game numbers repeat across courts, so "same round" means nothing now.
  // Block only if the incoming player is already booked in an unfinished game.
  const alreadyBooked = await prisma.matchPlayer.findFirst({
    where: { signUpId: inSignUpId, match: { sessionId: id, finishedAt: null } },
  });
  if (alreadyBooked && match.finishedAt == null) {
    return NextResponse.json({ error: "คนนี้มีเกมค้างอยู่แล้ว (กำลังเล่นหรือถูกจองคิวไว้)" }, { status: 400 });
  }

  const updated = await prisma.matchPlayer.update({
    where: { id: outPlayer.id },
    data: { signUpId: inSignUpId },
  });

  return NextResponse.json({ ok: true, updated });
}
