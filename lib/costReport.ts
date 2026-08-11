import { type CostAttendee, type CostRow } from "@/lib/costing";
import { formatHours } from "@/lib/billing";
import { type Cell } from "@/lib/xlsx";

/**
 * Turning a session's sign-up rows into billing input, in one place.
 *
 * The admin page, the .xlsx download and the LINE summary all bill the same
 * people the same way — including the two rules that are easy to get subtly
 * wrong elsewhere: a game only counts once it has finished, and someone with no
 * check-in and no check-out is a no-show.
 */

/** Prisma include that fetches exactly what costAttendees needs. */
export const COST_SIGNUP_INCLUDE = {
  matchSlots: { include: { match: { select: { finishedAt: true } } } },
} as const;

export interface CostSignUpLike {
  id: string;
  name: string;
  timeSlot: string;
  checkedInAt: Date | null;
  checkedOutAt: Date | null;
  matchSlots: { matchId: string; match: { finishedAt: Date | null } }[];
}

export function costAttendees(signUps: CostSignUpLike[]): CostAttendee[] {
  return signUps.map((s) => ({
    id: s.id,
    name: s.name,
    timeSlot: s.timeSlot as "EARLY" | "LATE",
    checkedOutAt: s.checkedOutAt,
    gamesPlayed: s.matchSlots.filter((ms) => ms.match.finishedAt != null).length,
    noShow: s.checkedInAt == null && s.checkedOutAt == null,
  }));
}

/** Distinct finished games in a session, counted from its sign-ups. */
export function finishedGameCount(signUps: CostSignUpLike[]): number {
  return new Set(
    signUps.flatMap((s) =>
      s.matchSlots.filter((ms) => ms.match.finishedAt != null).map((ms) => ms.matchId)
    )
  ).size;
}

/** "วันจันทร์ที่ 3 สิงหาคม 2569" — the label the exports are titled with. */
export function costDateLabel(date: Date): string {
  return date.toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

function timeLabel(d: Date): string {
  return d.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
}

/** One spreadsheet/PNG line per player, with the no-show tagged in the name. */
export interface ExportRow {
  name: string;
  slot: string;
  out: string;
  hours: string;
  games: number;
  courtBaht: number;
  ballBaht: number;
  totalBaht: number;
  live: boolean;
}

export function toExportRows(rows: CostRow[]): ExportRow[] {
  return rows.map((r) => ({
    // Tagged on the name too, so it shows on the PNG (which has no checkout
    // column) as well as in the Excel.
    name: r.noShow ? `${r.name} (ไม่มา)` : r.name,
    slot: r.slot,
    out: r.noShow ? "ไม่มา" : r.out ? timeLabel(r.out) : "ยังเล่นอยู่",
    hours: r.hours != null ? formatHours(r.hours) : "—",
    games: r.games,
    courtBaht: r.courtBaht,
    ballBaht: r.ballShareBaht,
    totalBaht: r.totalBaht,
    live: r.live,
  }));
}

export const XLSX_HEADER: Cell[] = [
  "ชื่อ",
  "เริ่ม",
  "เช็คเอาท์",
  "ชม.คิด",
  "เกม",
  "ค่าคอร์ท (฿)",
  "ค่าลูก (฿)",
  "รวม (฿)",
];

export const XLSX_COL_WIDTHS = [18, 8, 10, 9, 6, 13, 11, 11];

/** Header + body + totals, ready for buildXlsxBytes. */
export function xlsxSheetRows(rows: ExportRow[]): Cell[][] {
  const body: Cell[][] = rows.map((r) => [
    r.name,
    r.slot,
    r.out,
    r.hours,
    r.games,
    r.courtBaht,
    r.ballBaht,
    r.totalBaht,
  ]);
  const total: Cell[] = [
    `รวม ${rows.length} คน`,
    "",
    "",
    "",
    rows.reduce((a, r) => a + r.games, 0),
    rows.reduce((a, r) => a + r.courtBaht, 0),
    rows.reduce((a, r) => a + r.ballBaht, 0),
    rows.reduce((a, r) => a + r.totalBaht, 0),
  ];
  return [XLSX_HEADER, ...body, total];
}

/** Download name: readable, unique per minute, safe for every OS. */
export function xlsxFileName(venue: string, dateLabel: string, now: Date = new Date()): string {
  const safe = `${venue}-${dateLabel}`.replace(/[^\w฀-๿]+/g, "-").replace(/^-+|-+$/g, "");
  const stamp = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join("");
  return `cost-${safe || "export"}-${stamp}.xlsx`;
}
