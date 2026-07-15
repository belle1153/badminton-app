import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { bookFoursome } from "@/lib/queue";

/**
 * Place a hand-picked 2v2 onto a court (starts playing now). If `court` is
 * omitted, books the lowest-numbered free open court automatically. Games
 * are never pre-queued onto a busy court — everyone waiting stays in the
 * คู่เตรียม pool until a court frees. A player can only be booked in one
 * unfinished game at a time.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const team1: string[] = Array.isArray(body.team1) ? body.team1 : [];
  const team2: string[] = Array.isArray(body.team2) ? body.team2 : [];
  const court = body.court == null || body.court === "" ? undefined : Number(body.court);

  const result = await bookFoursome(id, team1, team2, court);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, matchId: result.matchId, round: result.round, court: result.court });
}
