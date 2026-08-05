import { blockStart, billedHours, courtCostByPerson, parseCourtHourCosts } from "./billing";

/**
 * The per-person bill, in ONE place. The admin's คำนวณ page and the players'
 * own cost tab both render from this, so what a player is told they owe is
 * derived exactly the same way the admin sees it — and a player can trace it:
 * games played → ball share, hours present → court share.
 */

/** Flat fee charged to a confirmed sign-up who never checked in (a no-show). */
export const NO_SHOW_FEE = 10;

export interface CostAttendee {
  id: string;
  name: string;
  timeSlot: "EARLY" | "LATE";
  checkedOutAt: Date | null;
  gamesPlayed: number;
  /** Signed up for a seat but never checked in — billed the flat no-show fee. */
  noShow?: boolean;
}

export interface CostRow {
  id: string;
  name: string;
  slot: string; // "19.00" | "20.00" — the block start time
  timeSlot: "EARLY" | "LATE";
  out: Date | null;
  /** Billed hours — null while they're still playing (not checked out yet). */
  hours: number | null;
  games: number;
  /** Court share with the per-head fee already folded in — the club bills the
   *  fee as part of the court cost and doesn't itemise it. Exact, so it can end
   *  in .5 for a half-hour player; only totalBaht is rounded. */
  courtBaht: number;
  ballShareBaht: number;
  totalBaht: number;
  /** Still on the clock: their court share can still grow. */
  live: boolean;
  /** Confirmed sign-up who never came — billed the flat no-show fee only. */
  noShow: boolean;
}

interface CostSession {
  courtsEarly: number;
  courtsLate: number;
  date: Date;
  lateOpenedAt: Date | null;
  openCourts?: string | null;
  /** Admin's actual court baht per hour ("400,600,520,0"); null = auto. */
  courtHourCosts?: string | null;
}

export function buildCostRows(
  session: CostSession,
  attendees: CostAttendee[],
  rate: number,
  ballPrice: number,
  feePerPerson: number,
  now: Date = new Date()
): { rows: CostRow[]; courtHourUnits: number } {
  const { perPerson: courtShare, units } = courtCostByPerson(
    session,
    // No-shows never used a court, so they don't share the court cost or shift
    // anyone else's split.
    attendees
      .filter((a) => !a.noShow)
      .map((a) => ({ id: a.id, timeSlot: a.timeSlot, checkedOutAt: a.checkedOutAt })),
    rate,
    now,
    parseCourtHourCosts(session.courtHourCosts)
  );

  const rows = attendees
    .map((a) => {
      // Didn't come: flat no-show fee, no court/ball, no clock.
      if (a.noShow) {
        return {
          id: a.id,
          name: a.name,
          slot: a.timeSlot === "EARLY" ? "19.00" : "20.00",
          timeSlot: a.timeSlot,
          out: null,
          hours: null,
          games: 0,
          courtBaht: 0,
          ballShareBaht: 0,
          totalBaht: NO_SHOW_FEE,
          live: false,
          noShow: true,
        };
      }
      const start = blockStart(session.date, a.timeSlot);
      const hours = a.checkedOutAt ? billedHours(start, a.checkedOutAt) : null;
      // 1 ball per game shared by 4 players → each pays a quarter of a ball.
      // Kept as an exact fraction (e.g. 73.5); only the row total is rounded,
      // the same way the club's spreadsheet does it.
      const ballShareBaht = (a.gamesPlayed / 4) * ballPrice;
      // The per-head fee rides along with the court cost — the club quotes one
      // court number, so it is never shown as its own line.
      //
      // Rounded up in exactly the two places the จันทร์ sheet rounds: the hourly
      // rate (ROUNDUP of cost ÷ heads, inside courtCostByPerson) and the row
      // total. NOT here — the sheet's court column is left exact, so someone on
      // court half an hour carries a .5 through to the total rather than paying
      // a baht extra. (The พุธ sheet rounds the other way round: exact rate,
      // rounded court. Its figures are a baht lower for half-hour players; the
      // club chose the จันทร์ method.)
      const courtBaht = (courtShare.get(a.id) ?? 0) + feePerPerson;
      return {
        id: a.id,
        name: a.name,
        slot: a.timeSlot === "EARLY" ? "19.00" : "20.00",
        timeSlot: a.timeSlot,
        out: a.checkedOutAt,
        hours,
        games: a.gamesPlayed,
        courtBaht,
        ballShareBaht,
        totalBaht: Math.ceil(courtBaht + ballShareBaht),
        live: a.checkedOutAt == null,
        noShow: false,
      };
    })
    // 1 ทุ่ม (19.00) block first, then 2 ทุ่ม, each A-Z by name.
    .sort(
      (a, b) =>
        (a.timeSlot === "EARLY" ? 0 : 1) - (b.timeSlot === "EARLY" ? 0 : 1) ||
        a.name.localeCompare(b.name, "th")
    );

  return { rows, courtHourUnits: units };
}

/**
 * Prices a session is billed at: whatever the admin picked for the day, else the
 * first master entry. Both pages resolve them the same way so a closed day reads
 * back exactly as it was charged.
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
