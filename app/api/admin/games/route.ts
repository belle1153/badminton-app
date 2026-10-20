import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { insertSchedule } from "@/lib/games/insertSchedule";
import { DEFAULT_TEAMS } from "@/lib/games/schedule";

const forbidden = () => NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });

export async function GET() {
  if (!(await isAdmin())) return forbidden();
  const events = await prisma.gamesEvent.findMany({
    orderBy: { date: "desc" },
    select: { id: true, name: true, date: true, published: true, createdAt: true },
  });
  return NextResponse.json(events);
}

/** New event with the poster's six teams and the full timetable, ready to fill in. */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return forbidden();
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const date = String(body.date ?? "");
  if (!name) return NextResponse.json({ error: "กรุณาใส่ชื่องาน" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "วันที่ไม่ถูกต้อง" }, { status: 400 });

  // One transaction, so a failure part-way never leaves an event without its timetable.
  const id = await prisma.$transaction(
    async (tx) => {
      const event = await tx.gamesEvent.create({
        data: {
          name,
          date: new Date(`${date}T00:00:00Z`),
          teams: { create: DEFAULT_TEAMS.map((t) => ({ seed: t.seed, name: t.name, color: t.color })) },
        },
        select: { id: true, teams: { select: { id: true, seed: true } } },
      });
      await insertSchedule(tx, event.id, event.teams);
      return event.id;
    },
    { timeout: 20_000 }
  );

  return NextResponse.json({ id });
}
