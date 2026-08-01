import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { parseQuestInput } from "@/lib/questInput";

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

  const parsed = parseQuestInput(await req.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const quest = await prisma.quest.create({ data: parsed.data });
  return NextResponse.json(quest);
}
