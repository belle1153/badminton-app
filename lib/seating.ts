import { prisma } from "@/lib/db";
import { assignSeats, WAITLIST_LIMIT, type SeatInput, type TimeSlot } from "@/lib/signup";
import { blockCapacities } from "@/lib/capacity";

interface SessionLike {
  id: string;
  maxPlayers: number;
  courtsEarly: number;
}

/**
 * Recompute seat assignments for every active sign-up and write back only the
 * rows that changed. Runs after each sign-up / withdrawal so the EARLY↔LATE
 * queue cascades stay correct. Caller decides whether to run it (skip when the
 * session is closed / registration frozen).
 */
export async function rebalanceSession(session: SessionLike): Promise<void> {
  const signups = await prisma.signUp.findMany({
    where: { sessionId: session.id, status: { not: "WITHDRAWN" } },
  });

  const { earlyCapacity, totalCapacity } = blockCapacities(session);
  const lateCap = Math.max(0, totalCapacity - earlyCapacity);

  const inputs: SeatInput[] = signups.map((s) => ({
    id: s.id,
    preferredSlot: s.preferredSlot as TimeSlot,
    createdAt: s.createdAt,
  }));
  const results = assignSeats(inputs, earlyCapacity, lateCap, WAITLIST_LIMIT);

  const byId = new Map(signups.map((s) => [s.id, s]));
  const updates = [];
  for (const r of results) {
    const cur = byId.get(r.id);
    if (!cur) continue;
    if (cur.status !== r.status || cur.timeSlot !== r.timeSlot || cur.slotNumber !== r.slotNumber) {
      updates.push(
        prisma.signUp.update({
          where: { id: r.id },
          data: { status: r.status, timeSlot: r.timeSlot, slotNumber: r.slotNumber },
        })
      );
    }
  }
  if (updates.length > 0) await prisma.$transaction(updates);
}
