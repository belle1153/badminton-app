import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

const forbidden = () => NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

type Params = { params: Promise<{ eventId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await isAdmin())) return forbidden();
  const { eventId } = await params;
  const body = await req.json().catch(() => ({}));
  const data: {
    name?: string;
    date?: Date;
    qualifierRubberMinutes?: number;
    knockoutRubberMinutes?: number;
    published?: boolean;
    rankOverride?: string | null;
  } = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return bad("กรุณาใส่ชื่องาน");
    data.name = name;
  }
  if (body.date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date))) return bad("วันที่ไม่ถูกต้อง");
    data.date = new Date(`${body.date}T00:00:00Z`);
  }
  for (const key of ["qualifierRubberMinutes", "knockoutRubberMinutes"] as const) {
    if (body[key] !== undefined) {
      const n = Number(body[key]);
      if (!Number.isInteger(n) || n < 1 || n > 120) return bad("เวลาต่อคู่ต้องเป็น 1–120 นาที");
      data[key] = n;
    }
  }
  if (body.published !== undefined) data.published = Boolean(body.published);
  if (body.rankOverride !== undefined) {
    if (body.rankOverride === null) data.rankOverride = null;
    else if (Array.isArray(body.rankOverride) && body.rankOverride.every((x: unknown) => typeof x === "string")) {
      data.rankOverride = body.rankOverride.join(",");
    } else return bad("ลำดับทีมไม่ถูกต้อง");
  }
  if (Object.keys(data).length === 0) return bad("ไม่มีข้อมูลให้แก้ไข");

  try {
    await prisma.gamesEvent.update({ where: { id: eventId }, data });
  } catch {
    return NextResponse.json({ error: "ไม่พบงานนี้" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await isAdmin())) return forbidden();
  const { eventId } = await params;
  try {
    await prisma.gamesEvent.delete({ where: { id: eventId } });
  } catch {
    return NextResponse.json({ error: "ไม่พบงานนี้" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
