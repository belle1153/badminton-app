import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { signUpId } = body;

  const target = await prisma.signUp.findUnique({ where: { id: signUpId } });
  if (!target || target.sessionId !== id) {
    return NextResponse.json({ error: "ไม่พบผู้เล่นนี้ในรอบนี้" }, { status: 404 });
  }
  if (!target.fixedPartnerId) {
    return NextResponse.json({ ok: true });
  }
  const partnerId = target.fixedPartnerId;

  // A คู่เตรียม built while they were a fixed pair has them stored on the same
  // team — clearing fixedPartnerId alone doesn't touch it, so they'd keep playing
  // together until that คู่เตรียม is used up. Drop any คู่เตรียม that still holds
  // either of them; those four go back to the queue and get re-matched fresh
  // (now free to be split). Games already on court aren't touched.
  const stalePending = await prisma.pendingPair.findMany({
    where: { sessionId: id },
    select: { id: true, team1Ids: true, team2Ids: true },
  });
  const toDelete = stalePending
    .filter((p) => {
      const members = [...p.team1Ids, ...p.team2Ids];
      return members.includes(target.id) || members.includes(partnerId);
    })
    .map((p) => p.id);

  await prisma.$transaction([
    prisma.signUp.update({ where: { id: target.id }, data: { fixedPartnerId: null } }),
    prisma.signUp.update({ where: { id: partnerId }, data: { fixedPartnerId: null } }),
    prisma.pendingPair.deleteMany({ where: { id: { in: toDelete } } }),
  ]);

  return NextResponse.json({ ok: true, clearedPending: toDelete.length });
}
