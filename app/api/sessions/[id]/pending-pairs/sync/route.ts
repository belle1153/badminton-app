import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { syncPendingQueue } from "@/lib/queue";

/**
 * Top up the คู่เตรียม queue from the checked-in players who are free but not
 * yet queued. Idempotent — safe to call on every admin match-page load. The
 * client fires this when the set of free players changes (someone checks in,
 * a game frees four) so the queue fills itself without reshuffling the คู่เตรียม
 * that are already laid out.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }
  const { id } = await params;
  const created = await syncPendingQueue(id);
  return NextResponse.json({ ok: true, created });
}
