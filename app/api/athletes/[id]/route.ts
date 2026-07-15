import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { SKILL_LABELS } from "@/lib/matching";

// Derived from the canonical skill list in lib/matching so this never drifts
// out of sync if a level is ever added or renamed.
const VALID_SKILLS = new Set(Object.keys(SKILL_LABELS));

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const data: { name?: string; skillLevel?: string; photoUrl?: string | null } = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "กรุณาใส่ชื่อ" }, { status: 400 });
    // Case-insensitive duplicate check against everyone else.
    const dup = await prisma.athlete.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, NOT: { id } },
    });
    if (dup) {
      return NextResponse.json({ error: `มีชื่อ "${dup.name}" อยู่แล้วในรายชื่อ` }, { status: 409 });
    }
    data.name = name;
  }
  if (body.skillLevel !== undefined) {
    if (!VALID_SKILLS.has(body.skillLevel)) {
      return NextResponse.json({ error: "ระดับฝีมือไม่ถูกต้อง" }, { status: 400 });
    }
    data.skillLevel = body.skillLevel;
  }
  if (body.photoUrl !== undefined) {
    if (body.photoUrl === null) {
      data.photoUrl = null;
    } else {
      const url = String(body.photoUrl);
      if (!url.startsWith("data:image/") || url.length > 300_000) {
        return NextResponse.json({ error: "รูปไม่ถูกต้องหรือใหญ่เกินไป" }, { status: 400 });
      }
      data.photoUrl = url;
    }
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

    // Keep this athlete's sign-ups in currently-open sessions in sync so the
    // check-in list / courts board reflect the edit (they read the per-sign-up
    // snapshot). Closed sessions stay as historical record. Only name/skill
    // live on the sign-up — the photo is athlete-only.
    const signupData: { name?: string; skillLevel?: string } = {};
    if (data.name !== undefined) signupData.name = data.name;
    if (data.skillLevel !== undefined) signupData.skillLevel = data.skillLevel;
    if (Object.keys(signupData).length > 0) {
      const active = await prisma.signUp.findMany({
        where: { athleteId: id, status: { not: "WITHDRAWN" }, session: { status: "OPEN" } },
        select: { id: true },
      });
      if (active.length > 0) {
        await prisma.signUp.updateMany({
          where: { id: { in: active.map((s) => s.id) } },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: signupData as any,
        });
      }
    }

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
