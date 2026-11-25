/** Club standard: how many players a given number of courts accepts. */
export const COURT_CAPACITY: Record<number, number> = {
  2: 14,
  3: 22,
  4: 28,
  5: 36,
  6: 42,
};

export const COURT_OPTIONS = [2, 3, 4, 5, 6];

/** How many players a new day takes unless the admin types another number.
 *  The 5 reserves (WAITLIST_LIMIT) come on top of this. */
export const DEFAULT_MAX_PLAYERS = 28;
const MAX_PLAYERS_LIMIT = 200;

/** The admin's typed capacity as a whole number 1–200, or null if it isn't one. */
export function parseMaxPlayers(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value.trim()) : Number(value);
  if (value === "" || value == null || !Number.isInteger(n)) return null;
  return n >= 1 && n <= MAX_PLAYERS_LIMIT ? n : null;
}

export function capacityFor(courts: number): number {
  return COURT_CAPACITY[courts] ?? courts * 7;
}

/**
 * A session has two blocks: 1 ทุ่ม (EARLY) on courtsEarly courts, expanding
 * at 2 ทุ่ม (LATE) to courtsLate courts. Early slots are 1..earlyCapacity,
 * late slots fill the remainder up to the session total. totalCapacity is the
 * stored maxPlayers, which the admin types per day (default 28) — it no longer
 * follows the court count.
 */
export function blockCapacities(session: {
  maxPlayers: number;
  courtsEarly: number;
}): { earlyCapacity: number; totalCapacity: number } {
  const totalCapacity = session.maxPlayers;
  const earlyCapacity = Math.min(capacityFor(session.courtsEarly), totalCapacity);
  return { earlyCapacity, totalCapacity };
}
