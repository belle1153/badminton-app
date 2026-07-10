import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { nextSlotAssignment, promoteAfterWithdrawal, type TimeSlot } from "@/lib/signup";
import { blockCapacities } from "@/lib/capacity";

const SLOT_LABEL: Record<TimeSlot, string> = { EARLY: "1 ทุ่ม", LATE: "2 ทุ่ม" };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { athleteId, confirmMove } = body;
  const timeSlot: TimeSlot = body.timeSlot === "LATE" ? "LATE" : "EARLY";
  let { name } = body;

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "ไม่พบรอบนี้" }, { status: 404 });
  }
  if (session.status === "CLOSED") {
    return NextResponse.json({ error: "รอบนี้ปิดแล้ว ไม่สามารถลงชื่อได้" }, { status: 400 });
  }

  // Skill level is assessed by the admin, not self-reported: returning
  // athletes keep their assessed level, brand-new names start at RK.
  let athlete;
  if (athleteId) {
    athlete = await prisma.athlete.findUnique({ where: { id: athleteId } });
    if (!athlete) {
      return NextResponse.json({ error: "ไม่พบนักกีฬานี้" }, { status: 404 });
    }
    name = athlete.name;
  } else {
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "กรุณาใส่ชื่อ" }, { status: 400 });
    }
    name = name.trim();
    athlete = await prisma.athlete.upsert({
      where: { name },
      create: { name, skillLevel: "RK" },
      update: {},
    });
  }
  const skillLevel = athlete.skillLevel;

  const existing = await prisma.signUp.findMany({
    where: { sessionId: id, status: { not: "WITHDRAWN" } },
  });
  const { earlyCapacity, totalCapacity } = blockCapacities(session);

  // Same person signing again: warn first; with confirmation it's a request
  // to move to the other block, allowed only if that block has a free seat.
  const already = existing.find((s) => s.athleteId === athlete.id || s.name === name);
  if (already) {
    if (!confirmMove) {
      return NextResponse.json(
        {
          error: `"${name}" ลงชื่อไว้แล้ว (รอบ ${SLOT_LABEL[already.timeSlot as TimeSlot]}${already.status === "WAITLIST" ? " — สำรอง" : ""})`,
          alreadySignedUp: true,
          currentTimeSlot: already.timeSlot,
        },
        { status: 409 }
      );
    }
    if (already.timeSlot === timeSlot) {
      return NextResponse.json(
        { error: `ลงรอบ ${SLOT_LABEL[timeSlot]} อยู่แล้วครับ` },
        { status: 400 }
      );
    }
    const others = existing.filter((s) => s.id !== already.id);
    const target = nextSlotAssignment(
      others.map((s) => ({ ...s, timeSlot: s.timeSlot as TimeSlot })),
      timeSlot,
      earlyCapacity,
      totalCapacity
    );
    if (!target || target.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: `รอบ ${SLOT_LABEL[timeSlot]} เต็มแล้ว ย้ายไม่ได้ครับ` },
        { status: 400 }
      );
    }
    const wasConfirmed = already.status === "CONFIRMED";
    const vacatedSlot = already.timeSlot as TimeSlot;
    const moved = await prisma.signUp.update({
      where: { id: already.id },
      data: { timeSlot, slotNumber: target.slotNumber, status: "CONFIRMED" },
    });
    if (wasConfirmed) {
      const remaining = await prisma.signUp.findMany({
        where: { sessionId: id, status: { not: "WITHDRAWN" } },
      });
      const promotion = promoteAfterWithdrawal(
        remaining.map((s) => ({ ...s, timeSlot: s.timeSlot as TimeSlot })),
        vacatedSlot,
        earlyCapacity,
        totalCapacity
      );
      if (promotion) {
        await prisma.signUp.update({
          where: { id: promotion.promoteId },
          data: { status: "CONFIRMED", slotNumber: promotion.slotNumber },
        });
      }
    }
    return NextResponse.json(moved);
  }

  const assignment = nextSlotAssignment(
    existing.map((s) => ({ ...s, timeSlot: s.timeSlot as TimeSlot })),
    timeSlot,
    earlyCapacity,
    totalCapacity,
    { forceWaitlist: session.registrationClosedAt != null }
  );
  if (!assignment) {
    return NextResponse.json(
      { error: "เต็มแล้วครับ (รวมรายชื่อสำรอง 5 คน)" },
      { status: 400 }
    );
  }

  const signUp = await prisma.signUp.create({
    data: {
      sessionId: id,
      name,
      skillLevel,
      timeSlot,
      status: assignment.status,
      slotNumber: assignment.slotNumber,
      athleteId: athlete.id,
    },
  });

  return NextResponse.json(signUp);
}
