import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

/**
 * Start the event over: every lineup, score, live count and SECRET CARD is
 * cleared, and the manual rank order is dropped. Teams, players, the timetable
 * and court moves stay as they are.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  const { eventId } = await params;

  const ev = await prisma.gamesEvent.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!ev) return NextResponse.json({ error: "ไม่พบงานนี้" }, { status: 404 });

  await prisma.$transaction(
    [
      prisma.gamesCard.deleteMany({ where: { eventId } }),
      prisma.gamesRubber.updateMany({
        where: { tie: { eventId } },
        data: {
          a1Id: null, a2Id: null, b1Id: null, b2Id: null,
          set1A: null, set1B: null, set2A: null, set2B: null, set3A: null, set3B: null,
          finishedAt: null, liveSet: null, liveStartedAt: null,
        },
      }),
      prisma.gamesEvent.update({ where: { id: eventId }, data: { rankOverride: null } }),
    ]
  );
  return NextResponse.json({ ok: true });
}
