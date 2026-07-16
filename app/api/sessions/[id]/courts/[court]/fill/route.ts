import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { dropReadyPending, syncPendingQueue } from "@/lib/queue";

/**
 * "ดึงคิวลงสนาม" — put the next คู่เตรียม on this court. The คู่เตรียม queue IS
 * the waiting queue now, so this sends the front-most ready one down rather than
 * grabbing four raw names: every line-up has been on screen (and editable)
 * before it plays.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; court: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id, court: courtParam } = await params;
  const court = Number(courtParam);

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) return NextResponse.json({ error: "ไม่พบรอบนี้" }, { status: 404 });
  if (session.status === "CLOSED") {
    return NextResponse.json({ error: "รอบนี้ปิดแล้ว" }, { status: 400 });
  }
  if (!Number.isInteger(court) || court < 1 || court > session.courtsLate) {
    return NextResponse.json({ error: "สนามไม่ถูกต้อง" }, { status: 400 });
  }

  const dropped = await dropReadyPending(id, court);
  if (!dropped.ok) {
    return NextResponse.json(
      {
        error:
          dropped.reason === "none_ready"
            ? "ยังไม่มีคู่เตรียมที่พร้อมลง — กด \"จัดคู่เตรียมจากคิว\" ก่อน หรือรอคนในคู่เตรียมจบเกม"
            : dropped.reason,
      },
      { status: 400 }
    );
  }

  // The court that just filled freed up คู่เตรียม slots — restock so the next
  // line-up is already on screen for review.
  await syncPendingQueue(id);

  return NextResponse.json({ ok: true, matchId: dropped.matchId, round: dropped.round, court });
}
