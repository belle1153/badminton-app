import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { dropReadyPending } from "@/lib/queue";
import { openCourtNumbers } from "@/lib/billing";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id, matchId } = await params;
  const body = await req.json();
  const winnerTeam = Number(body.winnerTeam); // 1 | 2 | 0 = เสมอ (draw)
  const closeCourt = body.closeCourt === true; // "จบแล้วปิดคอร์ท" — don't refill

  if (winnerTeam !== 1 && winnerTeam !== 2 && winnerTeam !== 0) {
    return NextResponse.json({ error: "ต้องเลือกทีมที่ชนะ หรือเสมอ" }, { status: 400 });
  }

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || match.sessionId !== id) {
    return NextResponse.json({ error: "ไม่พบแมทช์นี้" }, { status: 404 });
  }
  if (match.finishedAt != null) {
    return NextResponse.json({ error: "แมทช์นี้จบไปแล้ว" }, { status: 400 });
  }

  await prisma.match.update({
    where: { id: matchId },
    data: { finishedAt: new Date(), winnerTeam: winnerTeam === 0 ? null : winnerTeam },
  });

  // "จบแล้วปิดคอร์ท": end the game and stop the court — no refill — so the four
  // become free and can check out. Used to wind courts down at end of day. Close
  // it by dropping this court from the open set (switches to an explicit set).
  if (closeCourt) {
    const session = await prisma.session.findUnique({ where: { id } });
    if (session) {
      const nextOpen = openCourtNumbers(session).filter((c) => c !== match.court);
      await prisma.session.update({ where: { id }, data: { openCourts: nextOpen.join(",") } });
    }
    return NextResponse.json({ ok: true, court: match.court, filled: false, closed: true });
  }

  // A pre-queued game slides up to become the court's current game by itself;
  // only auto-fill from the waiting queue when nothing is queued on this court.
  const hasUpcoming = await prisma.match.findFirst({
    where: { sessionId: id, court: match.court, finishedAt: null },
    select: { id: true },
  });
  if (hasUpcoming) {
    return NextResponse.json({ ok: true, court: match.court, filled: false, nextQueued: true });
  }

  // Nobody reaches a court without having been visible in คู่เตรียม first, so the
  // admin always gets to eyeball the line-up (and ✎ it) before it runs. Drop the
  // front-most READY คู่เตรียม onto this court — it has been on screen since it
  // was queued, so it counts as reviewed. "Ready" = every member free and
  // checked in (never drop one with a ยังไม่มา player).
  // There is deliberately no auto-fill fallback here: if no คู่เตรียม is ready the
  // court just stays empty until the admin sends one down.
  // A stale คู่เตรียม that won't book (e.g. someone withdrew) is left alone for
  // the admin to fix — the court stays empty rather than filling itself.
  // Nor is คู่เตรียม re-stocked from the four who just finished: new คู่เตรียม
  // only ever come from the admin pressing "จัดคู่เตรียมจากคิว" (or picking four
  // by hand), never from the system on its own.
  const dropped = await dropReadyPending(id, match.court);
  const fromPending = dropped.ok;

  return NextResponse.json({ ok: true, court: match.court, filled: fromPending, fromPending });
}
