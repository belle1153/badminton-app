import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { loadCourtState } from "@/lib/queue";

/**
 * Clear the waiting queue: un-check-in everyone who is currently waiting (not
 * on a court). Players in an active game are left alone. They can be checked
 * back in from the เช็คอิน page if they return.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;
  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) return NextResponse.json({ error: "ไม่พบรอบนี้" }, { status: 404 });

  const state = await loadCourtState(id);
  const waitingIds = state.queue.map((q) => q.id);
  if (waitingIds.length === 0) {
    return NextResponse.json({ ok: true, cleared: 0 });
  }

  await prisma.signUp.updateMany({
    where: { id: { in: waitingIds } },
    data: { checkedInAt: null },
  });

  return NextResponse.json({ ok: true, cleared: waitingIds.length });
}
