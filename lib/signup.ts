export type SignUpStatus = "CONFIRMED" | "WAITLIST" | "WITHDRAWN";
export type TimeSlot = "EARLY" | "LATE";

export const WAITLIST_LIMIT = 5;

export interface SignUpRecord {
  id: string;
  status: SignUpStatus;
  timeSlot: TimeSlot;
  slotNumber: number | null;
  createdAt: Date | string;
}

function slotRange(
  timeSlot: TimeSlot,
  earlyCapacity: number,
  totalCapacity: number
): [number, number] {
  return timeSlot === "EARLY" ? [1, earlyCapacity] : [earlyCapacity + 1, totalCapacity];
}

function firstFreeSlotInRange(
  existing: SignUpRecord[],
  range: [number, number]
): number | null {
  const used = new Set(
    existing
      .filter((s) => s.status === "CONFIRMED" && s.slotNumber != null)
      .map((s) => s.slotNumber as number)
  );
  for (let n = range[0]; n <= range[1]; n++) {
    if (!used.has(n)) return n;
  }
  return null;
}

/**
 * Assign a new sign-up into its chosen time block (1 ทุ่ม = slots
 * 1..earlyCapacity, 2 ทุ่ม = the rest). A full block sends the person to the
 * waitlist, which is capped; a null return means the session cannot take
 * anyone else at all.
 */
export function nextSlotAssignment(
  existing: SignUpRecord[],
  timeSlot: TimeSlot,
  earlyCapacity: number,
  totalCapacity: number,
  options: { forceWaitlist?: boolean } = {}
): { status: "CONFIRMED" | "WAITLIST"; slotNumber: number | null } | null {
  const active = existing.filter((s) => s.status !== "WITHDRAWN");

  if (!options.forceWaitlist) {
    const slot = firstFreeSlotInRange(active, slotRange(timeSlot, earlyCapacity, totalCapacity));
    if (slot != null) return { status: "CONFIRMED", slotNumber: slot };
  }

  const waitlistCount = active.filter((s) => s.status === "WAITLIST").length;
  if (waitlistCount < WAITLIST_LIMIT) {
    return { status: "WAITLIST", slotNumber: null };
  }
  return null;
}

/**
 * After a CONFIRMED sign-up leaves a block, promote the earliest WAITLIST
 * entry that chose the same block — people who signed up for 2 ทุ่ม never
 * drift into the 1 ทุ่ม block, and vice versa. `existing` must exclude the
 * departing entry.
 */
export function promoteAfterWithdrawal(
  existing: SignUpRecord[],
  vacatedTimeSlot: TimeSlot,
  earlyCapacity: number,
  totalCapacity: number
): { promoteId: string; slotNumber: number } | null {
  const active = existing.filter((s) => s.status !== "WITHDRAWN");
  const waitlist = active
    .filter((s) => s.status === "WAITLIST" && s.timeSlot === vacatedTimeSlot)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  if (waitlist.length === 0) return null;

  const slot = firstFreeSlotInRange(
    active,
    slotRange(vacatedTimeSlot, earlyCapacity, totalCapacity)
  );
  if (slot == null) return null;
  return { promoteId: waitlist[0].id, slotNumber: slot };
}
