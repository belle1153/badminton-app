import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { duplicateIds, parsePairs } from "@/lib/games/input";

/**
 * Save one team's paper lineup for a tie: pairs 1–5 in order. Incomplete
 * lineups save fine (flexibility first); the only refusal is one player twice.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ tieId: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  const { tieId } = await params;
  const body = await req.json().catch(() => ({}));

  const side = body.side;
  if (side !== "A" && side !== "B") return NextResponse.json({ error: "ต้องระบุฝั่ง A หรือ B" }, { status: 400 });
  const pairs = parsePairs(body.pairs);
  if (!pairs) return NextResponse.json({ error: "ใบส่งตัวต้องมี 5 คู่" }, { status: 400 });

  const dups = duplicateIds(pairs);
  if (dups.length) {
    const names = await prisma.athlete.findMany({ where: { id: { in: dups } }, select: { name: true } });
    return NextResponse.json({ error: `ใส่ชื่อซ้ำ: ${names.map((n) => n.name).join(", ")}` }, { status: 400 });
  }

  const tie = await prisma.gamesTie.findUnique({ where: { id: tieId }, select: { id: true } });
  if (!tie) return NextResponse.json({ error: "ไม่พบแมตซ์นี้" }, { status: 404 });

  await prisma.$transaction(
    pairs.map(([p1, p2], i) =>
      prisma.gamesRubber.updateMany({
        where: { tieId, order: i + 1 },
        data: side === "A" ? { a1Id: p1, a2Id: p2 } : { b1Id: p1, b2Id: p2 },
      })
    )
  );
  return NextResponse.json({ ok: true });
}
