import { NextRequest, NextResponse } from "next/server";
import { announceRegistrationOpen } from "@/lib/registrationAnnounce";

export const dynamic = "force-dynamic";

/**
 * Friday 11:00 ICT (04:00 UTC) — scheduled from vercel.json — posts the one-time
 * "sign-ups are open" message to the LINE group. Idempotent: announceRegistration
 * Open stamps each day, so re-runs (or a same-day admin button) don't repeat it.
 *
 * Vercel Cron attaches `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is
 * set; we reject anything else so the endpoint can't be triggered publicly.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await announceRegistrationOpen();
  return NextResponse.json(result);
}
