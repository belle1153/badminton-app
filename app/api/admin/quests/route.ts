import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { QUEST_KINDS } from "@/lib/quests";

const VALID_KINDS = new Set(QUEST_KINDS.map((k) => k.kind));

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }
  const quests = await prisma.quest.findMany({
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(quests);
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const { kind, icon, startDate, endDate, target, expReward } = body;

  if (!title) return NextResponse.json({ error: "ใส่ชื่อเควสด้วยครับ" }, { status: 400 });
  if (!VALID_KINDS.has(kind)) {
    return NextResponse.json({ error: "ประเภทเควสไม่ถูกต้อง" }, { status: 400 });
  }

  // Dates arrive as yyyy-mm-dd and are stored at UTC midnight, matching
  // Session.date, so range comparisons line up with how play days are recorded.
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "วันที่ไม่ถูกต้อง" }, { status: 400 });
  }
  if (end.getTime() <= start.getTime()) {
    return NextResponse.json({ error: "วันสิ้นสุดต้องหลังวันเริ่ม" }, { status: 400 });
  }

  const reward = Number(expReward);
  if (!Number.isFinite(reward) || reward <= 0) {
    return NextResponse.json({ error: "EXP ต้องมากกว่า 0" }, { status: 400 });
  }

  const spec = QUEST_KINDS.find((k) => k.kind === kind)!;
  const needsTarget = spec.targetLabel != null;
  const targetValue = needsTarget ? Number(target) : null;
  if (needsTarget && (!Number.isFinite(targetValue) || (targetValue as number) <= 0)) {
    return NextResponse.json({ error: `ใส่${spec.targetLabel}ด้วยครับ` }, { status: 400 });
  }

  const quest = await prisma.quest.create({
    data: {
      title,
      kind,
      icon: typeof icon === "string" && icon.trim() ? icon.trim() : "🎯",
      startDate: start,
      endDate: end,
      target: targetValue,
      expReward: Math.round(reward),
    },
  });

  return NextResponse.json(quest);
}
