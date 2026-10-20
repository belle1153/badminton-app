/**
 * "Who is on which court" without anyone pressing start (agreed with the
 * organisers): every rubber has a court and a scheduled start, so the first
 * rubber on a court that has no result yet is the one being played, and the one
 * after it is next. The screen therefore lags the hall by however long a result
 * slip takes to reach the desk — accepted.
 */
export interface CourtRubber {
  id: string;
  court: number;
  order: number;
  startMinute: number;
  finished: boolean;
  cancelled: boolean;
}

export interface CourtNowNext {
  court: number;
  nowId: string | null;
  /** The current rubber's scheduled start has passed ("กำลังแข่ง" vs "รอลง"). */
  nowStarted: boolean;
  nextId: string | null;
}

export function courtsNowNext(rubbers: CourtRubber[], nowMinute: number): CourtNowNext[] {
  const courts = [...new Set(rubbers.map((r) => r.court))].sort((a, b) => a - b);
  return courts.map((court) => {
    const queue = rubbers
      .filter((r) => r.court === court && !r.finished && !r.cancelled)
      .sort((a, b) => a.startMinute - b.startMinute || a.order - b.order);
    const now = queue[0] ?? null;
    return {
      court,
      nowId: now?.id ?? null,
      nowStarted: now != null && now.startMinute <= nowMinute,
      nextId: queue[1]?.id ?? null,
    };
  });
}
