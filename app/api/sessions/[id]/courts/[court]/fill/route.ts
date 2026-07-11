import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { fillCourt } from "@/lib/queue";

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

  const fill = await fillCourt(id, court);
  if (!fill.ok) {
    const msg =
      fill.reason === "court_taken"
        ? `สนาม ${court} มีคนเล่นอยู่แล้ว`
        : "คนในคิวไม่พอ 4 คน";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true, matchId: fill.matchId, round: fill.round, court });
}
