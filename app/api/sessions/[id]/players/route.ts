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
 *
 * `timeSlot` is what they're billed from — 1 ทุ่ม bills from 19:00, 2 ทุ่ม from
 * 20:00 — so it has to be the admin's call, not a fixed guess.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const skillLevel = body.skillLevel;
  const timeSlot: "EARLY" | "LATE" = body.timeSlot === "EARLY" ? "EARLY" : "LATE";

  if (!name) return NextResponse.json({ error: "กรุณาใส่ชื่อ" }, { status: 400 });
  if (!VALID_SKILLS.has(skillLevel)) {
    return NextResponse.json({ error: "ระดับมือไม่ถูกต้อง" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) return NextResponse.json({ error: "ไม่พบรอบนี้" }, { status: 404 });
  if (session.status === "CLOSED") {
    return NextResponse.json({ error: "รอบนี้ปิดแล้ว" }, { status: 400 });
  }

  // Case-insensitive match so "NW"/"nw" don't become two athletes.
  const found = await prisma.athlete.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  const athlete = found
    ? await prisma.athlete.update({ where: { id: found.id }, data: { skillLevel } })
    : await prisma.athlete.create({ data: { name, skillLevel } });

  // Already in this session → just make sure they're checked in with this skill.
  const existing = await prisma.signUp.findFirst({
    where: {
      sessionId: id,
      status: { not: "WITHDRAWN" },
      OR: [{ athleteId: athlete.id }, { name: { equals: name, mode: "insensitive" } }],
    },
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
      name: athlete.name, // canonical spelling
      skillLevel,
      // rebalanceSession below reseats everyone from preferredSlot, so this is
      // just the starting point it works from.
      timeSlot,
      preferredSlot: timeSlot,
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
