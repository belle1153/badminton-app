import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

const VALID_SKILLS = ["RK", "N_MINUS", "N", "N_PLUS", "S", "S_PLUS", "BG", "BG_PLUS", "P"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const data: { name?: string; skillLevel?: string } = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "กรุณาใส่ชื่อ" }, { status: 400 });
    data.name = name;
  }
  if (body.skillLevel !== undefined) {
    if (!VALID_SKILLS.includes(body.skillLevel)) {
      return NextResponse.json({ error: "ระดับฝีมือไม่ถูกต้อง" }, { status: 400 });
    }
    data.skillLevel = body.skillLevel;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "ไม่มีข้อมูลให้แก้ไข" }, { status: 400 });
  }

  try {
    const updated = await prisma.athlete.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data as any,
    });
    return NextResponse.json(updated);
  } catch (err) {
    // Unique constraint on name
    if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "มีชื่อนี้อยู่แล้วในรายชื่อ" }, { status: 409 });
    }
    return NextResponse.json({ error: "ไม่พบนักกีฬานี้" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.athlete.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "ไม่พบนักกีฬานี้" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
