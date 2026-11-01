import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { announceRegistrationOpen } from "@/lib/registrationAnnounce";

/** The "sign-ups are open" LINE post — the only way it is sent now that the
 *  automatic 11:00 cron is gone. Idempotent: a day is stamped once announced,
 *  so a second tap just reports it was already sent. */
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await announceRegistrationOpen(new Date());
  return NextResponse.json(result);
}
