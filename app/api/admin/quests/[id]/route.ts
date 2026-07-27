import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

/** Toggle a quest on or off. Kept separate from delete so a finished month's
 *  quest can be retired without losing what it was. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "ต้องระบุ active" }, { status: 400 });
  }
  const quest = await prisma.quest.update({ where: { id }, data: { active: body.active } });
  return NextResponse.json(quest);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.quest.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
