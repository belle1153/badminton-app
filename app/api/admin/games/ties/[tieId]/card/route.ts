import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { CARD_KINDS, cardProblem, type CardKind } from "@/lib/games/cards";
import { tieLabel } from "@/lib/games/schedule";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

type Params = { params: Promise<{ tieId: string }> };

function loadTie(tieId: string) {
  return prisma.gamesTie.findUnique({
    where: { id: tieId },
    select: {
      id: true,
      eventId: true,
      stage: true,
      teamAId: true,
      teamBId: true,
      rubbers: { select: { id: true, order: true, a1Id: true, a2Id: true, b1Id: true, b2Id: true } },
    },
  });
}

/** Swap two pairs of one side's lineup — SUBSTITUTION, and taking it back. */
function swapPairs(tie: NonNullable<Awaited<ReturnType<typeof loadTie>>>, side: "A" | "B", x: number, y: number) {
  const rx = tie.rubbers.find((r) => r.order === x);
  const ry = tie.rubbers.find((r) => r.order === y);
  if (!rx || !ry) return [];
  const [k1, k2] = side === "A" ? (["a1Id", "a2Id"] as const) : (["b1Id", "b2Id"] as const);
  return [
    prisma.gamesRubber.update({ where: { id: rx.id }, data: { [k1]: ry[k1], [k2]: ry[k2] } }),
    prisma.gamesRubber.update({ where: { id: ry.id }, data: { [k1]: rx[k1], [k2]: rx[k2] } }),
  ];
}

const isUniqueClash = (e: unknown) => typeof e === "object" && e != null && "code" in e && (e as { code: string }).code === "P2002";

/**
 * Play a SECRET CARD for one side of a qualifier tie: { side, kind, order, swapWith? }.
 * It replaces that side's card in this tie. SUBSTITUTION also swaps the two pairs in
 * the lineup, so it can't be replaced in place — remove it first (which swaps them back).
 */
export async function PUT(req: NextRequest, { params }: Params) {
  if (!(await isAdmin())) return bad("ต้องเป็นแอดมิน", 403);
  const { tieId } = await params;
  const body = await req.json().catch(() => ({}));
  const side = body.side;
  if (side !== "A" && side !== "B") return bad("ต้องระบุฝั่ง A หรือ B");
  const kind = body.kind as CardKind;
  if (!CARD_KINDS.includes(kind)) return bad("ไม่รู้จักการ์ดนี้");
  const order = Number(body.order);
  const swapWith = kind === "SUBSTITUTION" ? Number(body.swapWith) : null;

  const tie = await loadTie(tieId);
  if (!tie) return bad("ไม่พบแมตซ์นี้", 404);
  const teamId = side === "A" ? tie.teamAId : tie.teamBId;
  if (!teamId) return bad("ยังไม่รู้ว่าฝั่งนี้คือทีมไหน");

  const mine = await prisma.gamesCard.findMany({
    where: { eventId: tie.eventId, teamId },
    select: { id: true, tieId: true, kind: true, tie: { select: { stage: true, round: true, slot: true } } },
  });
  const current = mine.find((c) => c.tieId === tieId);
  if (current?.kind === "SUBSTITUTION") return bad("แมตซ์นี้ใช้ SUBSTITUTION แล้ว · ลบการ์ดก่อน (ระบบจะสลับคู่กลับให้)", 409);

  const problem = cardProblem({
    stage: tie.stage,
    kind,
    order,
    swapWith,
    usedElsewhere: mine
      .filter((c) => c.tieId !== tieId)
      .map((c) => ({ kind: c.kind, label: tieLabel(c.tie.stage, c.tie.round, c.tie.slot) })),
  });
  if (problem) return bad(problem, 409);

  try {
    await prisma.$transaction([
      ...(kind === "SUBSTITUTION" ? swapPairs(tie, side, order, swapWith!) : []),
      current
        ? prisma.gamesCard.update({ where: { id: current.id }, data: { kind, order, swapWith } })
        : prisma.gamesCard.create({ data: { eventId: tie.eventId, tieId, teamId, kind, order, swapWith } }),
    ]);
  } catch (e) {
    if (isUniqueClash(e)) return bad("การ์ดนี้ถูกใช้ไปแล้ว ลองรีเฟรชหน้า", 409);
    throw e;
  }
  return NextResponse.json({ ok: true });
}

/** Take back one side's card in this tie: { side }. A SUBSTITUTION swaps its two pairs back. */
export async function DELETE(req: NextRequest, { params }: Params) {
  if (!(await isAdmin())) return bad("ต้องเป็นแอดมิน", 403);
  const { tieId } = await params;
  const body = await req.json().catch(() => ({}));
  const side = body.side;
  if (side !== "A" && side !== "B") return bad("ต้องระบุฝั่ง A หรือ B");

  const tie = await loadTie(tieId);
  if (!tie) return bad("ไม่พบแมตซ์นี้", 404);
  const teamId = side === "A" ? tie.teamAId : tie.teamBId;
  const card = teamId ? await prisma.gamesCard.findUnique({ where: { tieId_teamId: { tieId, teamId } } }) : null;
  if (!card) return bad("ฝั่งนี้ยังไม่ได้ใช้การ์ดในแมตซ์นี้", 404);

  await prisma.$transaction([
    ...(card.kind === "SUBSTITUTION" && card.swapWith != null ? swapPairs(tie, side, card.order, card.swapWith) : []),
    prisma.gamesCard.delete({ where: { id: card.id } }),
  ]);
  return NextResponse.json({ ok: true });
}
