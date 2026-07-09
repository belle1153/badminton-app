import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { nextSlotAssignment } from "@/lib/signup";

const VALID_SKILLS = ["RK", "N_MINUS", "N", "N_PLUS", "S", "S_PLUS", "BG", "BG_PLUS", "P"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { athleteId } = body;
  let { name, skillLevel } = body;

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "ไม่พบรอบนี้" }, { status: 404 });
  }
  if (session.status === "CLOSED") {
    return NextResponse.json({ error: "รอบนี้ปิดแล้ว ไม่สามารถลงชื่อได้" }, { status: 400 });
  }

  let athlete;
  if (athleteId) {
    athlete = await prisma.athlete.findUnique({ where: { id: athleteId } });
    if (!athlete) {
      return NextResponse.json({ error: "ไม่พบนักกีฬานี้" }, { status: 404 });
    }
    name = athlete.name;
    skillLevel = skillLevel && VALID_SKILLS.includes(skillLevel) ? skillLevel : athlete.skillLevel;
  } else {
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "กรุณาใส่ชื่อ" }, { status: 400 });
    }
    if (!VALID_SKILLS.includes(skillLevel)) {
      return NextResponse.json({ error: "ระดับฝีมือไม่ถูกต้อง" }, { status: 400 });
    }
    name = name.trim();
    athlete = await prisma.athlete.upsert({
      where: { name },
      create: { name, skillLevel },
      update: { skillLevel },
    });
  }

  const existing = await prisma.signUp.findMany({
    where: { sessionId: id, status: { not: "WITHDRAWN" } },
  });

  const assignment = session.registrationClosedAt
    ? { status: "WAITLIST" as const, slotNumber: null }
    : nextSlotAssignment(existing, session.maxPlayers);

  const signUp = await prisma.signUp.create({
    data: {
      sessionId: id,
      name,
      skillLevel,
      status: assignment.status,
      slotNumber: assignment.slotNumber,
      athleteId: athlete.id,
    },
  });

  return NextResponse.json(signUp);
}
