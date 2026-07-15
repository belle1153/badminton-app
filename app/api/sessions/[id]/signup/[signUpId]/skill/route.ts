import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { SKILL_LABELS, type SkillLevel } from "@/lib/matching";

// Derived from the canonical skill list in lib/matching so this never drifts
// out of sync if a level is ever added or renamed.
const VALID_SKILLS = new Set(Object.keys(SKILL_LABELS));

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; signUpId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id, signUpId } = await params;
  const { skillLevel } = await req.json();

  if (!VALID_SKILLS.has(skillLevel)) {
    return NextResponse.json({ error: "ระดับฝีมือไม่ถูกต้อง" }, { status: 400 });
  }

  const signUp = await prisma.signUp.findUnique({ where: { id: signUpId } });
  if (!signUp || signUp.sessionId !== id || signUp.status === "WITHDRAWN") {
    return NextResponse.json({ error: "ไม่พบรายชื่อนี้" }, { status: 404 });
  }

  await prisma.signUp.update({
    where: { id: signUpId },
    data: { skillLevel: skillLevel as SkillLevel },
  });

  // Remember the assessment on the athlete so future sign-ups carry it.
  if (signUp.athleteId) {
    await prisma.athlete.update({
      where: { id: signUp.athleteId },
      data: { skillLevel: skillLevel as SkillLevel },
    });
  }

  return NextResponse.json({ ok: true });
}
