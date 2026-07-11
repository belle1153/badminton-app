export type SignUpStatus = "CONFIRMED" | "WAITLIST" | "WITHDRAWN";
export type TimeSlot = "EARLY" | "LATE";

export const WAITLIST_LIMIT = 5;

export interface SeatInput {
  id: string;
  preferredSlot: TimeSlot;
  createdAt: Date | string;
}

export interface SeatResult {
  id: string;
  status: "CONFIRMED" | "WAITLIST";
  timeSlot: TimeSlot;
  slotNumber: number | null;
  placed: boolean; // false = beyond all capacity (shouldn't happen if sign-up was gated)
}

/**
 * Assign every active sign-up to a seat, in sign-up order, so the two time
 * blocks behave the way the club wants:
 *
 * - 1 ทุ่ม (EARLY): seats 1..earlyCap.
 * - 2 ทุ่ม (LATE): the extra 8pm seats, earlyCap+1..earlyCap+lateCap.
 *
 * A person who wants 1 ทุ่ม but finds it full takes a 2 ทุ่ม seat instead
 * (so they still play at 8pm) while keeping preferredSlot = EARLY. Because
 * seats are recomputed from scratch on every change, when a 1 ทุ่ม seat later
 * frees up the earliest such person is pulled up into it automatically, and
 * the 2 ทุ่ม seat they vacate cascades to the next waitlisted person. Someone
 * who wants only 2 ทุ่ม (preferredSlot = LATE) never takes a 1 ทุ่ม seat.
 */
export function assignSeats(
  signups: SeatInput[],
  earlyCap: number,
  lateCap: number,
  waitlistCap: number
): SeatResult[] {
  const ordered = [...signups].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  let early = 0;
  let late = 0;
  let wait = 0;
  const out: SeatResult[] = [];

  for (const s of ordered) {
    if (s.preferredSlot === "EARLY") {
      if (early < earlyCap) {
        out.push({ id: s.id, status: "CONFIRMED", timeSlot: "EARLY", slotNumber: early + 1, placed: true });
        early++;
      } else if (late < lateCap) {
        out.push({
          id: s.id,
          status: "CONFIRMED",
          timeSlot: "LATE",
          slotNumber: earlyCap + late + 1,
          placed: true,
        });
        late++;
      } else {
        const placed = wait < waitlistCap;
        out.push({ id: s.id, status: "WAITLIST", timeSlot: "EARLY", slotNumber: null, placed });
        wait++;
      }
    } else {
      if (late < lateCap) {
        out.push({
          id: s.id,
          status: "CONFIRMED",
          timeSlot: "LATE",
          slotNumber: earlyCap + late + 1,
          placed: true,
        });
        late++;
      } else {
        const placed = wait < waitlistCap;
        out.push({ id: s.id, status: "WAITLIST", timeSlot: "LATE", slotNumber: null, placed });
        wait++;
      }
    }
  }

  return out;
}
