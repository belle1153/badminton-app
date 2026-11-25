import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { COURT_CAPACITY, DEFAULT_MAX_PLAYERS, parseMaxPlayers } from "@/lib/capacity";
import { normalizeStartTime } from "@/lib/sessionTime";

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
  const { date, venue, courtConfigNote, remark } = body;
  const startTime = normalizeStartTime(body.startTime);
  const courtsEarly = Number(body.courtsEarly ?? 3);
  const courtsLate = Number(body.courtsLate ?? courtsEarly);

  if (!date || !venue) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }
  if (!startTime) {
    return NextResponse.json({ error: "เวลาเริ่มไม่ถูกต้อง (เช่น 19:00)" }, { status: 400 });
  }
  if (!(courtsEarly in COURT_CAPACITY) || !(courtsLate in COURT_CAPACITY)) {
    return NextResponse.json({ error: "จำนวนคอร์ทต้องอยู่ระหว่าง 2-6" }, { status: 400 });
  }
  if (courtsLate < courtsEarly) {
    return NextResponse.json(
      { error: "คอร์ทช่วงสองต้องไม่น้อยกว่าช่วงแรก" },
      { status: 400 }
    );
  }

  // The admin types how many people the day takes (the 5 reserves come on
  // top); it no longer follows the court count.
  const maxPlayers =
    body.maxPlayers == null || body.maxPlayers === "" ? DEFAULT_MAX_PLAYERS : parseMaxPlayers(body.maxPlayers);
  if (maxPlayers == null) {
    return NextResponse.json({ error: "จำนวนคนที่รับต้องเป็นเลข 1–200" }, { status: 400 });
  }

  const session = await prisma.session.create({
    data: {
      date: new Date(date),
      venue,
      startTime,
      maxPlayers,
      courtsEarly,
      courtsLate,
      courtConfigNote: courtConfigNote || null,
      remark: remark || null,
    },
  });

  return NextResponse.json(session);
}
