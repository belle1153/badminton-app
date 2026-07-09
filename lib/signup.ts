export type SignUpStatus = "CONFIRMED" | "WAITLIST" | "WITHDRAWN";

export interface SignUpRecord {
  id: string;
  status: SignUpStatus;
  slotNumber: number | null;
  createdAt: Date | string;
}

function firstFreeSlot(usedSlots: Set<number>): number {
  let slot = 1;
  while (usedSlots.has(slot)) slot++;
  return slot;
}

/** Decide whether a new sign-up is confirmed into an open slot or waitlisted. */
export function nextSlotAssignment(
  existing: SignUpRecord[],
  maxPlayers: number
): { status: "CONFIRMED" | "WAITLIST"; slotNumber: number | null } {
  const confirmed = existing.filter((s) => s.status === "CONFIRMED");
  if (confirmed.length < maxPlayers) {
    const usedSlots = new Set(
      confirmed.filter((s) => s.slotNumber != null).map((s) => s.slotNumber as number)
    );
    return { status: "CONFIRMED", slotNumber: firstFreeSlot(usedSlots) };
  }
  return { status: "WAITLIST", slotNumber: null };
}

/**
 * After a CONFIRMED sign-up withdraws, promote the earliest WAITLIST entry (if any)
 * into the slot that just opened up. `existing` must exclude the withdrawing entry.
 */
export function promoteAfterWithdrawal(
  existing: SignUpRecord[]
): { promoteId: string; slotNumber: number } | null {
  const confirmed = existing.filter((s) => s.status === "CONFIRMED");
  const waitlist = existing
    .filter((s) => s.status === "WAITLIST")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (waitlist.length === 0) return null;

  const usedSlots = new Set(
    confirmed.filter((s) => s.slotNumber != null).map((s) => s.slotNumber as number)
  );
  return { promoteId: waitlist[0].id, slotNumber: firstFreeSlot(usedSlots) };
}
