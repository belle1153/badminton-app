import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assignSeats, WAITLIST_LIMIT, type SeatInput, type TimeSlot } from "@/lib/signup";
import { blockCapacities } from "@/lib/capacity";
import { rebalanceSession } from "@/lib/seating";

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
    // Case-insensitive: "NW", "nw", "Nw" are the same person — reuse the
    // existing athlete (and their canonical spelling) instead of creating dups.
    athlete = await prisma.athlete.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (athlete) {
      name = athlete.name;
    } else {
      athlete = await prisma.athlete.create({ data: { name, skillLevel: "RK" } });
    }
  }
  const skillLevel = athlete.skillLevel;

  const registrationClosed = session.registrationClosedAt != null;
  const existing = await prisma.signUp.findMany({
    where: { sessionId: id, status: { not: "WITHDRAWN" } },
  });
  const { earlyCapacity, totalCapacity } = blockCapacities(session);
  const lateCap = Math.max(0, totalCapacity - earlyCapacity);

  // Same person signing again → this is a request to switch their preferred
  // block. Warn first; on confirm, update the preference and let rebalancing
  // re-seat everyone (they'll play the new block if there's room, otherwise
  // sit in the other block / waitlist and keep the queue for their choice).
  const already = existing.find(
    (s) => s.athleteId === athlete.id || s.name.toLowerCase() === name.toLowerCase()
  );
  if (already) {
    // Same slot as before = plain duplicate; just tell them, don't offer a move.
    if (already.preferredSlot === timeSlot) {
      return NextResponse.json(
        {
          error: `"${name}" ลงชื่อรอบ ${SLOT_LABEL[timeSlot]} ไว้แล้วครับ${already.status === "WAITLIST" ? " (สำรอง)" : ""}`,
          duplicate: true,
        },
        { status: 400 }
      );
    }
    if (!confirmMove) {
      return NextResponse.json(
        {
          error: `"${name}" ลงชื่อไว้แล้ว (รอบ ${SLOT_LABEL[already.preferredSlot as TimeSlot]}${already.status === "WAITLIST" ? " — สำรอง" : ""})`,
          alreadySignedUp: true,
          currentTimeSlot: already.preferredSlot,
        },
        { status: 409 }
      );
    }
    await prisma.signUp.update({ where: { id: already.id }, data: { preferredSlot: timeSlot } });
    if (!registrationClosed) await rebalanceSession(session);
    const moved = await prisma.signUp.findUnique({ where: { id: already.id } });
    return NextResponse.json(moved);
  }

  // Registration soft-closed: new people can only queue as reserves.
  if (registrationClosed) {
    const waitCount = existing.filter((s) => s.status === "WAITLIST").length;
    if (waitCount >= WAITLIST_LIMIT) {
      return NextResponse.json({ error: "เต็มแล้วครับ (รวมรายชื่อสำรอง 5 คน)" }, { status: 400 });
    }
    const signUp = await prisma.signUp.create({
      data: {
        sessionId: id,
        name,
        skillLevel,
        timeSlot,
        preferredSlot: timeSlot,
        status: "WAITLIST",
        slotNumber: null,
        athleteId: athlete.id,
      },
    });
    return NextResponse.json(signUp);
  }

  // Registration open: work out where the newcomer lands (and reject only if
  // even the waitlist is full). Existing sign-ups keep their seats since the
  // newcomer sorts last, so no rebalance of others is needed here.
  const hypothetical: SeatInput[] = [
    ...existing.map((s) => ({
      id: s.id,
      preferredSlot: s.preferredSlot as TimeSlot,
      createdAt: s.createdAt,
    })),
    { id: "NEW", preferredSlot: timeSlot, createdAt: new Date() },
  ];
  const seat = assignSeats(hypothetical, earlyCapacity, lateCap, WAITLIST_LIMIT).find(
    (r) => r.id === "NEW"
  )!;
  if (!seat.placed) {
    return NextResponse.json({ error: "เต็มแล้วครับ (รวมรายชื่อสำรอง 5 คน)" }, { status: 400 });
  }

  const signUp = await prisma.signUp.create({
    data: {
      sessionId: id,
      name,
      skillLevel,
      timeSlot: seat.timeSlot,
      preferredSlot: timeSlot,
      status: seat.status,
      slotNumber: seat.slotNumber,
      athleteId: athlete.id,
    },
  });

  return NextResponse.json(signUp);
}
