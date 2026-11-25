import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { COURT_CAPACITY, parseMaxPlayers } from "@/lib/capacity";
import { normalizeStartTime } from "@/lib/sessionTime";
import { rebalanceSession } from "@/lib/seating";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "ไม่พบรอบเล่นนี้" }, { status: 404 });
  }
  if (session.status === "CLOSED") {
    return NextResponse.json({ error: "รอบนี้ปิดแล้ว แก้ไขไม่ได้" }, { status: 400 });
  }

  const courtsEarly = Number(body.courtsEarly ?? session.courtsEarly);
  const courtsLate = Number(body.courtsLate ?? session.courtsLate);

  if (!(courtsEarly in COURT_CAPACITY) || !(courtsLate in COURT_CAPACITY)) {
    return NextResponse.json({ error: "จำนวนคอร์ทต้องอยู่ระหว่าง 2-6" }, { status: 400 });
  }
  if (courtsLate < courtsEarly) {
    return NextResponse.json(
      { error: "คอร์ทช่วงสองต้องไม่น้อยกว่าช่วงแรก" },
      { status: 400 }
    );
  }

  // Start time and capacity are the admin's own per-day settings; a request
  // that leaves one out keeps what the day has.
  const startTime =
    body.startTime === undefined ? session.startTime : normalizeStartTime(body.startTime);
  if (!startTime) {
    return NextResponse.json({ error: "เวลาเริ่มไม่ถูกต้อง (เช่น 19:00)" }, { status: 400 });
  }
  const maxPlayers =
    body.maxPlayers === undefined ? session.maxPlayers : parseMaxPlayers(body.maxPlayers);
  if (maxPlayers == null) {
    return NextResponse.json({ error: "จำนวนคนที่รับต้องเป็นเลข 1–200" }, { status: 400 });
  }

  const updated = await prisma.session.update({
    where: { id },
    data: { courtsEarly, courtsLate, maxPlayers, startTime },
  });
  // Re-seat everyone against the new capacities: more seats pull reserves up,
  // fewer push the latest sign-ups back to reserve.
  if (maxPlayers !== session.maxPlayers || courtsEarly !== session.courtsEarly) {
    await rebalanceSession(updated);
  }

  return NextResponse.json({ ok: true, courtsEarly, courtsLate, maxPlayers, startTime });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.session.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "ไม่พบรอบเล่นนี้" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
