import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { COURT_CAPACITY, capacityFor } from "@/lib/capacity";

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
  const { date, venue, startTime, courtConfigNote, remark } = body;
  const courtsEarly = Number(body.courtsEarly ?? 3);
  const courtsLate = Number(body.courtsLate ?? courtsEarly);

  if (!date || !venue || !startTime) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }
  if (!(courtsEarly in COURT_CAPACITY) || !(courtsLate in COURT_CAPACITY)) {
    return NextResponse.json({ error: "จำนวนคอร์ทต้องอยู่ระหว่าง 2-6" }, { status: 400 });
  }
  if (courtsLate < courtsEarly) {
    return NextResponse.json(
      { error: "คอร์ทช่วง 2 ทุ่ม ต้องไม่น้อยกว่าช่วง 1 ทุ่ม" },
      { status: 400 }
    );
  }

  // Capacity follows the club's court table; explicit maxPlayers still wins
  // if a caller passes one (kept for compatibility with test tooling).
  const maxPlayers = body.maxPlayers ? Number(body.maxPlayers) : capacityFor(courtsLate);

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
