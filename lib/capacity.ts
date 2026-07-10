/** Club standard: how many players a given number of courts accepts. */
export const COURT_CAPACITY: Record<number, number> = {
  2: 14,
  3: 22,
  4: 28,
  5: 36,
  6: 42,
};

export const COURT_OPTIONS = [2, 3, 4, 5, 6];

export function capacityFor(courts: number): number {
  return COURT_CAPACITY[courts] ?? courts * 7;
}

/**
 * A session has two blocks: 1 ทุ่ม (EARLY) on courtsEarly courts, expanding
 * at 2 ทุ่ม (LATE) to courtsLate courts. Early slots are 1..earlyCapacity,
 * late slots fill the remainder up to the session total. totalCapacity comes
 * from the stored maxPlayers so sessions created before this scheme keep
 * their advertised size.
 */
export function blockCapacities(session: {
  maxPlayers: number;
  courtsEarly: number;
}): { earlyCapacity: number; totalCapacity: number } {
  const totalCapacity = session.maxPlayers;
  const earlyCapacity = Math.min(capacityFor(session.courtsEarly), totalCapacity);
  return { earlyCapacity, totalCapacity };
}
