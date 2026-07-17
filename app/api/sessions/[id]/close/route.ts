import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { courtCostByPerson } from "@/lib/billing";

/**
 * Close the day and freeze the totals. Everything is derived from actual play:
 * court cost = rate × Σ (open courts × block-hours) the group actually used,
 * ball cost = finished games × price (1 ball per game). The admin only picks
 * which rate / ball price applied.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { courtRateId, shuttlecockTypeId } = body;

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "ไม่พบรอบนี้" }, { status: 404 });
  }
  if (session.status === "CLOSED") {
    return NextResponse.json({ error: "รอบนี้ปิดไปแล้ว" }, { status: 400 });
  }

  const [courtRate, shuttlecockType, signUps, gamesPlayed, settings] = await Promise.all([
    prisma.courtRate.findUnique({ where: { id: courtRateId } }),
    prisma.shuttlecockType.findUnique({ where: { id: shuttlecockTypeId } }),
    prisma.signUp.findMany({
      where: { sessionId: id, status: { not: "WITHDRAWN" } },
      select: { id: true, timeSlot: true, checkedInAt: true, checkedOutAt: true },
    }),
    prisma.match.count({ where: { sessionId: id, finishedAt: { not: null } } }),
    prisma.appSettings.findUnique({ where: { id: "singleton" } }),
  ]);

  if (!courtRate || !shuttlecockType) {
    return NextResponse.json({ error: "ข้อมูลค่าคอร์ท/ลูกแบดไม่ถูกต้อง" }, { status: 400 });
  }

  const attendees = signUps
    .filter((s) => s.checkedInAt != null || s.checkedOutAt != null)
    .map((s) => ({ id: s.id, timeSlot: s.timeSlot, checkedOutAt: s.checkedOutAt }));

  const { total } = courtCostByPerson(session, attendees, courtRate.pricePerHour);
  const courtCost = Math.round(total);
  const shuttlecockCost = shuttlecockType.pricePerPiece * gamesPlayed;
  const totalCost = courtCost + shuttlecockCost;

  const updated = await prisma.session.update({
    where: { id },
    data: {
      courtRateId,
      courtHours: total / (courtRate.pricePerHour || 1), // court·hour units, for the record
      shuttlecockTypeId,
      shuttlecockQty: gamesPlayed,
      courtCost,
      shuttlecockCost,
      totalCost,
      // Freeze the fee that applied today — the cost pages read this back
      // instead of whatever the club's current fee happens to be later.
      feePerPerson: settings?.feePerPerson ?? 0,
      status: "CLOSED",
      closedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
}
