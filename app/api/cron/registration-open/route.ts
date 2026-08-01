import { NextRequest, NextResponse } from "next/server";
import { announceRegistrationOpen } from "@/lib/registrationAnnounce";

export const dynamic = "force-dynamic";

/**
 * 11:00 ICT (04:00 UTC) daily — scheduled from vercel.json — posts the one-time
 * "sign-ups are open" message to the LINE group.
 *
 * Daily, not Friday-only, so a Friday that failed gets another go: the send is
 * idempotent (announceRegistrationOpen stamps each day, and only on success),
 * so every run after a successful one is a no-op, while a run after a failure
 * retries it. Days stay eligible for a few days after sign-ups open — see
 * CRON_RETRY_WINDOW_MS.
 *
 * Vercel Cron attaches `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is
 * set; we reject anything else so the endpoint can't be triggered publicly.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // "cron" keeps the retry window: unattended, it must never retro-announce a
  // day that opened weeks ago.
  const result = await announceRegistrationOpen(new Date(), "cron");
  return NextResponse.json(result);
}
