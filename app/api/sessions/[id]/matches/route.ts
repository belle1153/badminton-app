import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { generateMatches, type Player } from "@/lib/matching";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const courtNumbers: number[] = Array.isArray(body.courtNumbers)
    ? body.courtNumbers.map(Number).filter((n: number) => Number.isInteger(n) && n >= 1 && n <= 6)
    : [];
  const signUpIds: string[] = Array.isArray(body.signUpIds) ? body.signUpIds : [];

  if (courtNumbers.length === 0) {
    return NextResponse.json({ error: "กรุณาเลือกสนามที่ใช้ได้อย่างน้อย 1 สนาม" }, { status: 400 });
  }
  if (signUpIds.length === 0) {
    return NextResponse.json({ error: "กรุณาเลือกคนที่มาเล่นอย่างน้อย 1 คน" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "ไม่พบรอบนี้" }, { status: 404 });
  }
  if (session.status === "CLOSED") {
    return NextResponse.json({ error: "รอบนี้ปิดแล้ว" }, { status: 400 });
  }

  const confirmed = await prisma.signUp.findMany({
    where: { sessionId: id, status: "CONFIRMED", id: { in: signUpIds } },
    orderBy: { slotNumber: "asc" },
  });

  const players: Player[] = confirmed.map((s) => ({
    id: s.id,
    name: s.name,
    skillLevel: s.skillLevel as Player["skillLevel"],
    fixedPartnerId: s.fixedPartnerId,
  }));

  const { matches, bench } = generateMatches(players, courtNumbers);

  const lastRound = await prisma.match.findFirst({
    where: { sessionId: id },
    orderBy: { round: "desc" },
  });
  const round = (lastRound?.round ?? 0) + 1;

  const created = await prisma.$transaction(
    matches.map((m) =>
      prisma.match.create({
        data: {
          sessionId: id,
          round,
          court: m.court,
          players: {
            create: [
              ...m.team1.map((p) => ({ signUpId: p.id, team: 1 })),
              ...m.team2.map((p) => ({ signUpId: p.id, team: 2 })),
            ],
          },
        },
        include: { players: { include: { signUp: true } } },
      })
    )
  );

  return NextResponse.json({ round, matches: created, bench });
}
