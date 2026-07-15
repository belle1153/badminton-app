import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

/** Cancel a คู่เตรียม the admin no longer wants (e.g. picked the wrong people). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; pendingId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id, pendingId } = await params;
  const pending = await prisma.pendingPair.findUnique({ where: { id: pendingId } });
  if (!pending || pending.sessionId !== id) {
    return NextResponse.json({ error: "ไม่พบคู่เตรียมนี้" }, { status: 404 });
  }

  await prisma.pendingPair.delete({ where: { id: pendingId } });
  return NextResponse.json({ ok: true });
}

/**
 * Swap one player in a คู่เตรียม for another checked-in person (the ✎ edit).
 * Persisted straight away so the edit survives — no separate "lock" step.
 *   - If the incoming player is sitting in ANOTHER คู่เตรียม, the two are
 *     exchanged (their slots trade), so nobody is dropped or duplicated.
 *   - Otherwise the incoming player takes the slot and the outgoing player goes
 *     back to the free queue (the next sync re-queues them at the back).
 * The incoming player may currently be mid-game — that just earmarks them; the
 * คู่เตรียม can't drop onto a court until everyone in it is free.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pendingId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id, pendingId } = await params;
  const body = await req.json();
  const outSignUpId: string = body.outSignUpId;
  const inSignUpId: string = body.inSignUpId;
  if (!outSignUpId || !inSignUpId) {
    return NextResponse.json({ error: "ต้องระบุคนออกและคนเข้า" }, { status: 400 });
  }

  const pending = await prisma.pendingPair.findUnique({ where: { id: pendingId } });
  if (!pending || pending.sessionId !== id) {
    return NextResponse.json({ error: "ไม่พบคู่เตรียมนี้" }, { status: 404 });
  }
  const members = [...pending.team1Ids, ...pending.team2Ids];
  if (!members.includes(outSignUpId)) {
    return NextResponse.json({ error: "ไม่พบผู้เล่นที่จะสลับออก" }, { status: 400 });
  }
  if (members.includes(inSignUpId)) {
    return NextResponse.json({ error: "ผู้เล่นคนนี้อยู่ในคู่นี้แล้ว" }, { status: 400 });
  }

  const incoming = await prisma.signUp.findUnique({ where: { id: inSignUpId } });
  if (!incoming || incoming.sessionId !== id || incoming.status === "WITHDRAWN") {
    return NextResponse.json({ error: "ผู้เล่นที่เลือกไม่ถูกต้อง" }, { status: 400 });
  }
  if (incoming.checkedInAt == null) {
    return NextResponse.json({ error: `${incoming.name} ยังไม่เช็คอิน` }, { status: 400 });
  }

  const swap = (ids: string[], from: string, to: string) => ids.map((x) => (x === from ? to : x));

  // If the incoming player is already earmarked in another คู่เตรียม, exchange
  // the two so neither is lost or double-booked.
  const others = await prisma.pendingPair.findMany({
    where: { sessionId: id, id: { not: pendingId } },
  });
  const otherPair = others.find((p) => [...p.team1Ids, ...p.team2Ids].includes(inSignUpId));

  await prisma.$transaction(async (tx) => {
    await tx.pendingPair.update({
      where: { id: pendingId },
      data: {
        team1Ids: swap(pending.team1Ids, outSignUpId, inSignUpId),
        team2Ids: swap(pending.team2Ids, outSignUpId, inSignUpId),
      },
    });
    if (otherPair) {
      await tx.pendingPair.update({
        where: { id: otherPair.id },
        data: {
          team1Ids: swap(otherPair.team1Ids, inSignUpId, outSignUpId),
          team2Ids: swap(otherPair.team2Ids, inSignUpId, outSignUpId),
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
