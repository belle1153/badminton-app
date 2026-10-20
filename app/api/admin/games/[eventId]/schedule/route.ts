import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { insertSchedule } from "@/lib/games/insertSchedule";

/**
 * Rebuild every tie and rubber from the timetable (e.g. after re-ordering team
 * seeds). Refused once any score exists, so a slip of the finger cannot wipe
 * results.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  const { eventId } = await params;

  const teams = await prisma.gamesTeam.findMany({ where: { eventId }, select: { id: true, seed: true } });
  if (teams.length === 0) return NextResponse.json({ error: "ไม่พบงานนี้" }, { status: 404 });

  const scored = await prisma.gamesRubber.count({
    where: { tie: { eventId }, OR: [{ set1A: { not: null } }, { finishedAt: { not: null } }] },
  });
  if (scored > 0) {
    return NextResponse.json({ error: "มีผลการแข่งแล้ว สร้างตารางใหม่ไม่ได้" }, { status: 409 });
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.gamesTie.deleteMany({ where: { eventId } });
      await insertSchedule(tx, eventId, teams);
    },
    { timeout: 20_000 }
  );
  return NextResponse.json({ ok: true });
}
