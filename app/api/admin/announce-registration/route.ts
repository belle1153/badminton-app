import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { announceRegistrationOpen } from "@/lib/registrationAnnounce";

/** Manual trigger for the "sign-ups are open" LINE post — the admin taps this at
 *  11:00 today. Shares the idempotency stamp with the Friday cron, so whichever
 *  runs first sends and the other no-ops. */
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await announceRegistrationOpen();
  return NextResponse.json(result);
}
