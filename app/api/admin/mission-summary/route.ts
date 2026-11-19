import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

/** Show or hide the มิชชั่นโคตรตึง summary page for players. */
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.open !== "boolean") return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: { missionSummaryOpen: body.open },
    create: { id: "singleton", missionSummaryOpen: body.open },
  });
  return NextResponse.json({ ok: true });
}
