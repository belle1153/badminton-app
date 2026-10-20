import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { loadGamesState } from "@/lib/games/load";

/**
 * The one snapshot every player and TV screen polls (every ~2 s). Once the
 * event is published the response may be shared by the CDN for a second, so
 * the database sees about one read per second however many screens are open.
 * Before publishing only admins get it (preview), never cached.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const state = await loadGamesState(eventId);
  if (!state) return NextResponse.json({ error: "ไม่พบงานนี้" }, { status: 404 });

  if (!state.event.published) {
    if (!(await isAdmin())) return NextResponse.json({ error: "coming soon" }, { status: 404 });
    return NextResponse.json(state, { headers: { "cache-control": "private, no-store" } });
  }

  return NextResponse.json(state, {
    headers: { "cache-control": "public, s-maxage=1, stale-while-revalidate=1" },
  });
}
