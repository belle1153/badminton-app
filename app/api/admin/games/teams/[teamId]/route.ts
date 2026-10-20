import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { memberConflicts } from "@/lib/games/input";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Edit a team: name, colour, logo, and its roster (memberIds replaces the list). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  if (!(await isAdmin())) return bad("ต้องเป็นแอดมิน", 403);
  const { teamId } = await params;
  const team = await prisma.gamesTeam.findUnique({ where: { id: teamId }, select: { id: true, eventId: true } });
  if (!team) return bad("ไม่พบทีมนี้", 404);

  const body = await req.json().catch(() => ({}));
  const data: { name?: string; color?: string; logoUrl?: string | null } = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return bad("กรุณาใส่ชื่อทีม");
    data.name = name;
  }
  if (body.color !== undefined) {
    if (!/^#[0-9a-f]{6}$/i.test(String(body.color))) return bad("สีต้องเป็นโค้ดแบบ #RRGGBB");
    data.color = String(body.color).toLowerCase();
  }
  if (body.logoUrl !== undefined) {
    if (body.logoUrl === null) data.logoUrl = null;
    else {
      const url = String(body.logoUrl);
      if (!url.startsWith("data:image/") || url.length > 300_000) return bad("รูปไม่ถูกต้องหรือใหญ่เกินไป");
      data.logoUrl = url;
    }
  }

  let memberIds: string[] | null = null;
  if (body.memberIds !== undefined) {
    if (!Array.isArray(body.memberIds) || !body.memberIds.every((x: unknown) => typeof x === "string")) {
      return bad("รายชื่อผู้เล่นไม่ถูกต้อง");
    }
    memberIds = [...new Set(body.memberIds as string[])];
    if (memberIds.length > 30) return bad("ผู้เล่นเยอะเกินไป");

    const [athletes, otherTeams] = await Promise.all([
      prisma.athlete.findMany({ where: { id: { in: memberIds } }, select: { id: true, name: true } }),
      prisma.gamesTeam.findMany({
        where: { eventId: team.eventId, NOT: { id: teamId } },
        select: { name: true, members: { select: { athleteId: true } } },
      }),
    ]);
    if (athletes.length !== memberIds.length) return bad("มีผู้เล่นที่ไม่อยู่ในรายชื่อนักกีฬา");
    const conflicts = memberConflicts(
      memberIds,
      otherTeams.map((t) => ({ name: t.name, memberIds: t.members.map((m) => m.athleteId) })),
      new Map(athletes.map((a) => [a.id, a.name]))
    );
    if (conflicts.length) return bad(`อยู่ทีมอื่นแล้ว: ${conflicts.join(", ")}`, 409);
  }

  if (Object.keys(data).length === 0 && memberIds === null) return bad("ไม่มีข้อมูลให้แก้ไข");

  if (Object.keys(data).length) await prisma.gamesTeam.update({ where: { id: teamId }, data });
  if (memberIds !== null) {
    await prisma.$transaction([
      prisma.gamesTeamMember.deleteMany({ where: { teamId } }),
      prisma.gamesTeamMember.createMany({ data: memberIds.map((athleteId) => ({ teamId, athleteId })) }),
    ]);
  }
  return NextResponse.json({ ok: true });
}
