import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { announceRegistrationOpen } from "@/lib/registrationAnnounce";

/** Manual trigger for the "sign-ups are open" LINE post — the admin taps this at
 *  11:00 today. Shares the idempotency stamp with the Friday cron, so whichever
 *  runs first sends and the other no-ops.
 *
 *  "manual" drops the cron's 24-hour freshness window: a person tapping the
 *  button means to post now, even if Friday 11:00 has been and gone. */
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await announceRegistrationOpen(new Date(), "manual");
  return NextResponse.json(result);
}
