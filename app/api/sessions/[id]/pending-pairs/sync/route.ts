import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { syncPendingQueue } from "@/lib/queue";

/**
 * Top up the คู่เตรียม queue from the checked-in players who are free but not
 * yet queued. Never reshuffles the คู่เตรียม already laid out. This is the ONLY
 * way คู่เตรียม get auto-formed — the admin pressing "จัดคู่เตรียมจากคิว";
 * finishing a game or filling a court no longer re-stocks the queue by itself.
 * A four that would exactly rerun a finished game is held to mix with the next
 * batch — unless `force` is sent (the button always sends it), because an
 * explicit press has to visibly act.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const created = await syncPendingQueue(id, body?.force === true);
  return NextResponse.json({ ok: true, created });
}
