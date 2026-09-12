import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

/**
 * Close the day: lock it (which reveals the per-person bill to players) and
 * freeze the pricing that applied — the flat entry + per-game fee — so a closed
 * day reads back exactly as charged. The club no longer tracks court or ball
 * cost in the app; the flat fee covers both.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "ไม่พบรอบนี้" }, { status: 404 });
  }
  if (session.status === "CLOSED") {
    return NextResponse.json({ error: "รอบนี้ปิดไปแล้ว" }, { status: 400 });
  }

  const [gamesPlayed, settings] = await Promise.all([
    prisma.match.count({ where: { sessionId: id, finishedAt: { not: null } } }),
    prisma.appSettings.findUnique({ where: { id: "singleton" } }),
  ]);

  const updated = await prisma.session.update({
    where: { id },
    data: {
      // Games played that day, kept as a record; court/ball costs are no longer
      // tracked, so their frozen figures are zero.
      shuttlecockQty: gamesPlayed,
      courtRateId: null,
      shuttlecockTypeId: null,
      courtHours: 0,
      courtCost: 0,
      shuttlecockCost: 0,
      totalCost: 0,
      // Freeze the per-person pricing that applied today.
      feePerPerson: settings?.feePerPerson ?? 0,
      entryFee: settings?.entryFee ?? 95,
      gameFee: settings?.gameFee ?? 25,
      status: "CLOSED",
      closedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
}
