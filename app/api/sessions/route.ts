import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

export async function GET() {
  const sessions = await prisma.session.findMany({
    orderBy: { date: "desc" },
    include: { signUps: { where: { status: { not: "WITHDRAWN" } } } },
  });
  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const body = await req.json();
  const { date, venue, startTime, maxPlayers, courtConfigNote, remark } = body;

  if (!date || !venue || !startTime || !maxPlayers) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  const session = await prisma.session.create({
    data: {
      date: new Date(date),
      venue,
      startTime,
      maxPlayers: Number(maxPlayers),
      courtConfigNote: courtConfigNote || null,
      remark: remark || null,
    },
  });

  return NextResponse.json(session);
}
