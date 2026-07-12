import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { rebalanceSession } from "@/lib/seating";
import { SKILL_LABELS } from "@/lib/matching";

const VALID_SKILLS = new Set(Object.keys(SKILL_LABELS));

/**
 * Admin quick-add: create a player straight into a session and check them in,
 * so they land in the waiting queue immediately (for walk-ins during play).
 * The admin sets the skill level here, which also updates the saved athlete.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const skillLevel = body.skillLevel;

  if (!name) return NextResponse.json({ error: "กรุณาใส่ชื่อ" }, { status: 400 });
  if (!VALID_SKILLS.has(skillLevel)) {
    return NextResponse.json({ error: "ระดับมือไม่ถูกต้อง" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) return NextResponse.json({ error: "ไม่พบรอบนี้" }, { status: 404 });
  if (session.status === "CLOSED") {
    return NextResponse.json({ error: "รอบนี้ปิดแล้ว" }, { status: 400 });
  }

  const athlete = await prisma.athlete.upsert({
    where: { name },
    create: { name, skillLevel },
    update: { skillLevel },
  });

  // Already in this session → just make sure they're checked in with this skill.
  const existing = await prisma.signUp.findFirst({
    where: { sessionId: id, status: { not: "WITHDRAWN" }, OR: [{ athleteId: athlete.id }, { name }] },
  });
  if (existing) {
    await prisma.signUp.update({
      where: { id: existing.id },
      data: { checkedInAt: existing.checkedInAt ?? new Date(), skillLevel, athleteId: athlete.id },
    });
    return NextResponse.json({ ok: true, signUpId: existing.id, alreadyExisted: true });
  }

  const created = await prisma.signUp.create({
    data: {
      sessionId: id,
      name,
      skillLevel,
      timeSlot: "LATE",
      preferredSlot: "LATE",
      status: "CONFIRMED",
      slotNumber: null,
      checkedInAt: new Date(),
      athleteId: athlete.id,
    },
  });
  // Re-seat everyone so capacity/waitlist stays correct (they keep their
  // check-in either way, so they're in the live queue regardless of block).
  await rebalanceSession(session);

  return NextResponse.json({ ok: true, signUpId: created.id });
}
