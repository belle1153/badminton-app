import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

/**
 * Set which courts are open. Body { openCourts: number[] } stores an explicit
 * open set (e.g. [1,2] or [3,4]); { openCourts: null } clears it back to the
 * automatic clock default. Admin only.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  let value: string | null;
  if (body.openCourts == null) {
    value = null; // back to auto
  } else if (Array.isArray(body.openCourts)) {
    const nums = [
      ...new Set(
        (body.openCourts as unknown[])
          .map((n) => Number(n))
          .filter((n) => Number.isInteger(n) && n > 0)
      ),
    ].sort((a: number, b: number) => a - b);
    value = nums.join(","); // "" when the admin closed every court
  } else {
    return NextResponse.json({ error: "openCourts ต้องเป็น array หรือ null" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) return NextResponse.json({ error: "ไม่พบรอบนี้" }, { status: 404 });

  await prisma.session.update({ where: { id }, data: { openCourts: value } });
  return NextResponse.json({ ok: true, openCourts: value });
}
