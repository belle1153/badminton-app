import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { SKILL_LABELS } from "@/lib/matching";

const VALID_SKILLS = new Set(Object.keys(SKILL_LABELS));

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json([]);
  }

  const athletes = await prisma.athlete.findMany({
    where: { name: { contains: q } },
    orderBy: { name: "asc" },
    take: 10,
  });

  return NextResponse.json(athletes);
}

// Admin adds a player to the roster (ข้อมูลผู้เล่น) with an assessed skill.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const skillLevel = body.skillLevel;

  if (!name) return NextResponse.json({ error: "กรุณาใส่ชื่อ" }, { status: 400 });
  if (!VALID_SKILLS.has(skillLevel)) {
    return NextResponse.json({ error: "ระดับมือไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const athlete = await prisma.athlete.create({ data: { name, skillLevel } });
    return NextResponse.json(athlete);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return NextResponse.json({ error: `"${name}" มีอยู่แล้ว` }, { status: 409 });
    }
    return NextResponse.json({ error: "เพิ่มไม่สำเร็จ" }, { status: 500 });
  }
}
