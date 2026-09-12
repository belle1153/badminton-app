import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

/**
 * Close the day and freeze the totals. Players are billed a flat entry + per-game
 * fee (frozen here so a closed day reads back exactly as charged); the club's own
 * cost record is the shuttlecocks used — finished games × price. Court rent is no
 * longer tracked in the app.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { shuttlecockTypeId } = body;

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "ไม่พบรอบนี้" }, { status: 404 });
  }
  if (session.status === "CLOSED") {
    return NextResponse.json({ error: "รอบนี้ปิดไปแล้ว" }, { status: 400 });
  }

  const [shuttlecockType, gamesPlayed, settings] = await Promise.all([
    prisma.shuttlecockType.findUnique({ where: { id: shuttlecockTypeId } }),
    prisma.match.count({ where: { sessionId: id, finishedAt: { not: null } } }),
    prisma.appSettings.findUnique({ where: { id: "singleton" } }),
  ]);

  if (!shuttlecockType) {
    return NextResponse.json({ error: "ข้อมูลลูกแบดไม่ถูกต้อง" }, { status: 400 });
  }

  const shuttlecockCost = shuttlecockType.pricePerPiece * gamesPlayed;

  const updated = await prisma.session.update({
    where: { id },
    data: {
      shuttlecockTypeId,
      shuttlecockQty: gamesPlayed,
      // Court rent is no longer tracked — the per-person bill covers it.
      courtRateId: null,
      courtHours: 0,
      courtCost: 0,
      shuttlecockCost,
      totalCost: shuttlecockCost,
      // Freeze the pricing that applied today — the cost pages read these back
      // instead of whatever the club's current values happen to be later.
      feePerPerson: settings?.feePerPerson ?? 0,
      entryFee: settings?.entryFee ?? 95,
      gameFee: settings?.gameFee ?? 25,
      status: "CLOSED",
      closedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
}
