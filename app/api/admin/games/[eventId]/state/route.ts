import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { loadGamesState } from "@/lib/games/load";

/** Same snapshot as the public endpoint, published or not, never cached —
 *  the admin's own edits must show the moment they are saved. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  const { eventId } = await params;
  const state = await loadGamesState(eventId);
  if (!state) return NextResponse.json({ error: "ไม่พบงานนี้" }, { status: 404 });
  return NextResponse.json(state, { headers: { "cache-control": "private, no-store" } });
}
