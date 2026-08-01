import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { parseQuestInput } from "@/lib/questInput";

/**
 * Edit a quest, or just toggle it on and off.
 *
 * A body with only `active` flips visibility; anything else is a full edit and
 * goes through the same validation as create. Editing in place matters because
 * the alternative — delete and recreate — takes back the EXP of everyone who
 * had already completed it. Switching the rule of a running quest is a real
 * need (a month-long quest written as once-only that should have paid daily),
 * and the payout simply recomputes for everyone.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();

  const toggleOnly = Object.keys(body).length === 1 && typeof body.active === "boolean";
  if (toggleOnly) {
    const quest = await prisma.quest.update({ where: { id }, data: { active: body.active } });
    return NextResponse.json(quest);
  }

  const parsed = parseQuestInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const quest = await prisma.quest.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(typeof body.active === "boolean" ? { active: body.active } : {}),
    },
  });
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
