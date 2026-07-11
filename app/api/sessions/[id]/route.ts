import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { COURT_CAPACITY, capacityFor } from "@/lib/capacity";
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
      { error: "คอร์ทช่วง 2 ทุ่ม ต้องไม่น้อยกว่าช่วง 1 ทุ่ม" },
      { status: 400 }
    );
  }

  // Recompute advertised size from the (new) late-block court count, matching
  // how creation derives it, then re-seat everyone against the new capacities.
  const maxPlayers = capacityFor(courtsLate);
  const updated = await prisma.session.update({
    where: { id },
    data: { courtsEarly, courtsLate, maxPlayers },
  });
  await rebalanceSession(updated);

  return NextResponse.json({ ok: true, courtsEarly, courtsLate, maxPlayers });
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
