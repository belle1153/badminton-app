import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { parseSets } from "@/lib/games/input";
import { setsFromColumns, validateResult } from "@/lib/games/rules";
import type { SetScore } from "@/lib/games/types";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Everything the admin does to one rubber: move court, write set scores (result
 * entry or each live-count tap — the whole set list is written, last write
 * wins), mark finished / reopen, and the live-count markers.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ rubberId: string }> }) {
  if (!(await isAdmin())) return bad("ต้องเป็นแอดมิน", 403);
  const { rubberId } = await params;
  const rubber = await prisma.gamesRubber.findUnique({
    where: { id: rubberId },
    select: {
      set1A: true, set1B: true, set2A: true, set2B: true, set3A: true, set3B: true,
      tie: { select: { stage: true } },
    },
  });
  if (!rubber) return bad("ไม่พบคู่นี้", 404);

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  let warnings: string[] = [];

  if (body.court !== undefined) {
    const court = Number(body.court);
    if (!Number.isInteger(court) || court < 1 || court > 20) return bad("เลขสนามไม่ถูกต้อง");
    data.court = court;
  }

  let sets: SetScore[] | null = null;
  if (body.sets !== undefined) {
    sets = parseSets(body.sets);
    if (!sets) return bad("แต้มต้องเป็นตัวเลข 0–99 ไม่เกิน 3 เซต");
    const at = (i: number, j: number) => sets![i]?.[j] ?? null;
    Object.assign(data, {
      set1A: at(0, 0), set1B: at(0, 1),
      set2A: at(1, 0), set2B: at(1, 1),
      set3A: at(2, 0), set3B: at(2, 1),
    });
  }

  if (body.finish === true) {
    const check = validateResult(rubber.tie.stage, sets ?? setsFromColumns(rubber));
    if (!check.ok) return bad(check.error);
    warnings = check.warnings;
    data.finishedAt = new Date();
    data.liveSet = null;
  } else if (body.finish === false) {
    data.finishedAt = null;
  }

  if (body.liveSet !== undefined && body.finish !== true) {
    if (body.liveSet !== null && ![1, 2, 3].includes(body.liveSet)) return bad("เซตที่นับสดไม่ถูกต้อง");
    data.liveSet = body.liveSet;
  }
  if (body.liveStartedAt !== undefined) {
    if (body.liveStartedAt === null) data.liveStartedAt = null;
    else {
      const d = new Date(String(body.liveStartedAt));
      if (Number.isNaN(d.getTime())) return bad("เวลาไม่ถูกต้อง");
      data.liveStartedAt = d;
    }
  }
  if (Object.keys(data).length === 0) return bad("ไม่มีข้อมูลให้แก้ไข");

  await prisma.gamesRubber.update({ where: { id: rubberId }, data });
  return NextResponse.json({ ok: true, warnings });
}
