import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { SKILL_LABELS } from "@/lib/matching";
import { rankNameMatches } from "@/lib/nameSearch";

const VALID_SKILLS = new Set(Object.keys(SKILL_LABELS));

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json([]);
  }

  // Name-search feeds type-ahead pickers only — never send photoUrl here, it's a
  // base64 data URL and would ship tens of KB per suggestion on every keystroke.
  //
  // Fetch every contains-match (the roster is small — well under a hundred
  // people) rather than the first 10 alphabetically, then rank: a plain
  // alphabetical take(10) can cut off an exact match entirely. "T" matches 21
  // real names (anything containing the letter), and the athlete literally
  // named "T" sorts after "Bank (Thaioil)", "First", "Note"… past the cutoff,
  // so the person searching their own name got zero useful results.
  const matches = await prisma.athlete.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    select: { id: true, name: true, skillLevel: true },
  });

  return NextResponse.json(rankNameMatches(q, matches, 10));
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

  // Case-insensitive duplicate check ("NW" vs "nw" is the same person).
  const dup = await prisma.athlete.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (dup) {
    return NextResponse.json({ error: `"${dup.name}" มีอยู่แล้ว` }, { status: 409 });
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
