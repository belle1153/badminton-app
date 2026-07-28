import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

/**
 * Set (or clear) the admin's actual court baht per hour for a session — the
 * per-person bill then splits these real amounts instead of open-courts × rate,
 * so it matches the venue's charge when courts empty out late in the evening.
 * Body: { costs: number[] } (hours 19,20,21,22) or { costs: null } to clear.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const costs = body.costs;

  let value: string | null = null;
  if (costs != null) {
    if (!Array.isArray(costs) || costs.some((c) => typeof c !== "number" || !Number.isFinite(c) || c < 0)) {
      return NextResponse.json({ error: "ค่าคอร์ทไม่ถูกต้อง" }, { status: 400 });
    }
    value = costs.map((c) => Math.round(c)).join(",");
  }

  const session = await prisma.session.findUnique({ where: { id }, select: { id: true } });
  if (!session) return NextResponse.json({ error: "ไม่พบรอบนี้" }, { status: 404 });

  await prisma.session.update({ where: { id }, data: { courtHourCosts: value } });
  return NextResponse.json({ ok: true });
}
