import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

const VALID_SKILLS = ["RK", "N_MINUS", "N", "N_PLUS", "S", "S_PLUS", "BG", "BG_PLUS", "P"] as const;
type Skill = (typeof VALID_SKILLS)[number];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; signUpId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id, signUpId } = await params;
  const { skillLevel } = await req.json();

  if (!VALID_SKILLS.includes(skillLevel)) {
    return NextResponse.json({ error: "ระดับฝีมือไม่ถูกต้อง" }, { status: 400 });
  }

  const signUp = await prisma.signUp.findUnique({ where: { id: signUpId } });
  if (!signUp || signUp.sessionId !== id || signUp.status === "WITHDRAWN") {
    return NextResponse.json({ error: "ไม่พบรายชื่อนี้" }, { status: 404 });
  }

  await prisma.signUp.update({
    where: { id: signUpId },
    data: { skillLevel: skillLevel as Skill },
  });

  // Remember the assessment on the athlete so future sign-ups carry it.
  if (signUp.athleteId) {
    await prisma.athlete.update({
      where: { id: signUp.athleteId },
      data: { skillLevel: skillLevel as Skill },
    });
  }

  return NextResponse.json({ ok: true });
}
