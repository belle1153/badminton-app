import type { Prisma } from "@/app/generated/prisma/client";
import { buildSchedule } from "./schedule";

const tieKey = (t: { stage: string; round: number | null; slot: number }) => `${t.stage}:${t.round ?? ""}:${t.slot}`;

/**
 * Write an event's whole timetable in two statements — every tie, then every
 * rubber — instead of a nested create per tie, which cost a few database round
 * trips each (20 ties took ~35 s against Neon from a dev machine).
 */
export async function insertSchedule(
  tx: Prisma.TransactionClient,
  eventId: string,
  teams: { id: string; seed: number }[]
): Promise<void> {
  const specs = buildSchedule(teams);
  const ties = await tx.gamesTie.createManyAndReturn({
    data: specs.map((t) => ({
      eventId,
      stage: t.stage,
      round: t.round,
      slot: t.slot,
      startsAt: t.startsAt,
      courtA: t.courtA,
      courtB: t.courtB,
      teamAId: t.teamAId,
      teamBId: t.teamBId,
    })),
    select: { id: true, stage: true, round: true, slot: true },
  });
  const tieIds = new Map(ties.map((t) => [tieKey(t), t.id]));
  await tx.gamesRubber.createMany({
    data: specs.flatMap((t) => t.rubbers.map((r) => ({ ...r, tieId: tieIds.get(tieKey(t))! }))),
  });
}
