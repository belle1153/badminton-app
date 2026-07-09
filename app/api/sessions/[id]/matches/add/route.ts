import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const round = Number(body.round);
  const court = Number(body.court);
  const team1: string[] = Array.isArray(body.team1) ? body.team1 : [];
  const team2: string[] = Array.isArray(body.team2) ? body.team2 : [];
  const playerIds = [...team1, ...team2];

  if (!Number.isInteger(round) || round < 1) {
    return NextResponse.json({ error: "รอบไม่ถูกต้อง" }, { status: 400 });
  }
  if (!Number.isInteger(court) || court < 1 || court > 6) {
    return NextResponse.json({ error: "สนามไม่ถูกต้อง" }, { status: 400 });
  }
  if (team1.length !== 2 || team2.length !== 2 || new Set(playerIds).size !== 4) {
    return NextResponse.json({ error: "ต้องเลือกผู้เล่น 4 คนไม่ซ้ำกัน (ทีมละ 2 คน)" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "ไม่พบรอบนี้" }, { status: 404 });
  }
  if (session.status === "CLOSED") {
    return NextResponse.json({ error: "รอบนี้ปิดแล้ว" }, { status: 400 });
  }

  const roundMatches = await prisma.match.findMany({
    where: { sessionId: id, round },
    include: { players: true },
  });
  if (roundMatches.length === 0) {
    return NextResponse.json({ error: "ยังไม่มีรอบนี้ ให้รันรอบก่อน" }, { status: 400 });
  }
  if (roundMatches.some((m) => m.court === court)) {
    return NextResponse.json({ error: `สนาม ${court} มีแมทช์ในรอบนี้แล้ว` }, { status: 400 });
  }

  const alreadyPlaying = new Set(roundMatches.flatMap((m) => m.players.map((p) => p.signUpId)));
  const signUps = await prisma.signUp.findMany({ where: { id: { in: playerIds } } });

  for (const pid of playerIds) {
    const s = signUps.find((x) => x.id === pid);
    if (!s || s.sessionId !== id || s.status === "WITHDRAWN") {
      return NextResponse.json({ error: "มีผู้เล่นที่เลือกไม่ถูกต้อง" }, { status: 400 });
    }
    if (s.status === "WAITLIST" && s.checkedInAt == null) {
      return NextResponse.json({ error: `${s.name} เป็นตัวสำรองที่ยังไม่เช็คอิน` }, { status: 400 });
    }
    if (alreadyPlaying.has(pid)) {
      return NextResponse.json({ error: `${s.name} เล่นอยู่ในรอบนี้แล้ว` }, { status: 400 });
    }
  }

  const created = await prisma.match.create({
    data: {
      sessionId: id,
      round,
      court,
      players: {
        create: [
          ...team1.map((pid) => ({ signUpId: pid, team: 1 })),
          ...team2.map((pid) => ({ signUpId: pid, team: 2 })),
        ],
      },
    },
  });

  return NextResponse.json({ ok: true, matchId: created.id });
}
