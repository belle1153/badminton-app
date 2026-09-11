/**
 * The per-person bill, in ONE place. The admin's คำนวณ page, the players' own
 * cost tab, the Excel/PNG exports and the LINE summary all render from this, so
 * what a player is told they owe is derived exactly the same way everywhere.
 *
 * The club charges a flat entry fee plus a per-game fee:
 *     bill = entryFee + gamesPlayed × gameFee
 * A confirmed sign-up who never came pays the flat no-show fine instead. What
 * the club itself pays the venue (court rent + shuttlecocks) is a separate
 * record, frozen at close — see lib/billing.ts and the close route.
 */

/** Flat fine charged to a confirmed sign-up who never checked in (a no-show). */
export const NO_SHOW_FEE = 100;

export interface CostAttendee {
  id: string;
  name: string;
  timeSlot: "EARLY" | "LATE";
  checkedOutAt: Date | null;
  gamesPlayed: number;
  /** Signed up for a seat but never checked in — billed the flat no-show fine. */
  noShow?: boolean;
  /** Admin has marked their bill collected. */
  paid?: boolean;
}

export interface CostRow {
  id: string;
  name: string;
  slot: string; // "19.00" | "20.00" — the block they played from
  timeSlot: "EARLY" | "LATE";
  /** Checkout time, or null while still on court / for a no-show. */
  out: Date | null;
  games: number;
  /** Flat entry fee (0 for a no-show). */
  entryBaht: number;
  /** gamesPlayed × gameFee (0 for a no-show). */
  gameBaht: number;
  totalBaht: number;
  /** Still on court: their game count (and so their bill) can still grow. */
  live: boolean;
  /** Confirmed sign-up who never came — billed the flat no-show fine only. */
  noShow: boolean;
  /** Bill already collected. */
  paid: boolean;
}

/**
 * Build one row per attendee. Pass EVERY sign-up that didn't withdraw — a
 * no-show still appears (shown ไม่มา, billed the flat fine), grouped at the top
 * so the fine is easy to collect.
 */
export function buildCostRows(
  attendees: CostAttendee[],
  entryFee: number,
  gameFee: number
): { rows: CostRow[] } {
  const rows = attendees
    .map((a): CostRow => {
      const base = {
        id: a.id,
        name: a.name,
        slot: a.timeSlot === "EARLY" ? "19.00" : "20.00",
        timeSlot: a.timeSlot,
        games: a.gamesPlayed,
        paid: a.paid ?? false,
      };
      // Didn't come: flat no-show fine, no entry/game, no clock.
      if (a.noShow) {
        return { ...base, out: null, games: 0, entryBaht: 0, gameBaht: 0, totalBaht: NO_SHOW_FEE, live: false, noShow: true };
      }
      const gameBaht = a.gamesPlayed * gameFee;
      return {
        ...base,
        out: a.checkedOutAt,
        entryBaht: entryFee,
        gameBaht,
        totalBaht: entryFee + gameBaht,
        live: a.checkedOutAt == null,
        noShow: false,
      };
    })
    // No-shows first (grouped for collecting the fine), then 1 ทุ่ม before
    // 2 ทุ่ม, each A–Z by name.
    .sort(
      (a, b) =>
        (a.noShow ? 0 : 1) - (b.noShow ? 0 : 1) ||
        (a.timeSlot === "EARLY" ? 0 : 1) - (b.timeSlot === "EARLY" ? 0 : 1) ||
        a.name.localeCompare(b.name, "th")
    );

  return { rows };
}

/**
 * Per-person pricing in force for a session: the values frozen onto it at close,
 * else the club's current settings (what closing it now would charge).
 */
export function sessionFees(
  session: { status: string; entryFee: number | null; gameFee: number | null },
  settings: { entryFee: number; gameFee: number } | null
): { entryFee: number; gameFee: number } {
  const closed = session.status === "CLOSED";
  return {
    entryFee: (closed ? session.entryFee : null) ?? settings?.entryFee ?? 0,
    gameFee: (closed ? session.gameFee : null) ?? settings?.gameFee ?? 0,
  };
}

/**
 * Court rate / ball price a session's CLUB cost is billed at (court rent +
 * shuttlecocks the club owes the venue) — unrelated to the per-person bill, kept
 * for the club's own record. Whatever the admin picked for the day, else the
 * first master entry. Both the close route and the cost page resolve them the
 * same way so a closed day reads back exactly as it was charged.
 */
export function sessionPrices(
  session: { courtRateId: string | null; shuttlecockTypeId: string | null },
  courtRates: { id: string; pricePerHour: number }[],
  shuttlecockTypes: { id: string; pricePerPiece: number }[]
): { rate: number; ballPrice: number } {
  const rate =
    (session.courtRateId ? courtRates.find((c) => c.id === session.courtRateId) : courtRates[0])
      ?.pricePerHour ?? 0;
  const ballPrice =
    (session.shuttlecockTypeId
      ? shuttlecockTypes.find((s) => s.id === session.shuttlecockTypeId)
      : shuttlecockTypes[0])?.pricePerPiece ?? 0;
  return { rate, ballPrice };
}
