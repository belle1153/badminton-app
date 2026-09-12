import { describe, expect, it } from "vitest";
import { formatCostMessage, openDayMessage } from "./lineCost";
import { type CostRow } from "./costing";

const session = {
  date: new Date(Date.UTC(2026, 7, 3)), // Monday 03.08.2026
  venue: "แหลมฉบัง",
  courtsEarly: 3,
  courtsLate: 5,
};

const ENTRY = 95;
const GAME = 25;

const row = (over: Partial<CostRow>): CostRow => ({
  id: over.name ?? "x",
  name: "ใครสักคน",
  slot: "19.00",
  timeSlot: "EARLY",
  out: null,
  games: 3,
  entryBaht: 95,
  gameBaht: 75,
  totalBaht: 170,
  live: false,
  noShow: false,
  paid: false,
  ...over,
});

describe("formatCostMessage", () => {
  const rows = [
    row({ name: "พี่เอียด", totalBaht: 195, games: 4 }),
    row({ name: "Ja", timeSlot: "LATE", slot: "20.00", totalBaht: 120, games: 1 }),
    row({ name: "Bankki", games: 0, entryBaht: 0, gameBaht: 0, totalBaht: 100, noShow: true }),
  ];
  const text = formatCostMessage(session, rows, 42, ENTRY, GAME);

  it("heads with the day, venue and game count", () => {
    expect(text).toContain("🗓 Monday 03.08.2026 · แหลมฉบัง");
    expect(text).toContain("42 เกม");
  });

  it("splits the two blocks and bills each player by games", () => {
    expect(text).toContain("🔸รอบ 1 ทุ่ม (19.00)🔸");
    expect(text).toContain("พี่เอียด — 195฿ (4 เกม)");
    expect(text).toContain("🔸รอบ 2 ทุ่ม (20.00)🔸");
    expect(text).toContain("Ja — 120฿ (1 เกม)");
  });

  it("lists no-shows separately with the fine", () => {
    expect(text).toContain("🔴 ไม่มา (ปรับ 100฿)");
    expect(text).toContain("Bankki — 100฿");
  });

  it("totals everyone and flags the outstanding balance", () => {
    expect(text).toContain("💵 รวมเก็บ 415 ฿ · 3 คน");
    expect(text).toContain("🔴 ค้างจ่าย 3 คน · 415 ฿");
    expect(text).toContain("📌 ค่าสนาม 95฿ + เกมละ 25฿");
  });

  it("ticks people already marked จ่ายแล้ว and drops them from the outstanding total", () => {
    const paidText = formatCostMessage(
      session,
      [row({ name: "พี่เอียด", totalBaht: 195, paid: true }), row({ name: "Ja", totalBaht: 120 })],
      10,
      ENTRY,
      GAME
    );
    expect(paidText).toContain("✅ พี่เอียด — 195฿");
    expect(paidText).toContain("🔴 ค้างจ่าย 1 คน · 120 ฿");
  });

  it("says เก็บครบแล้ว when everyone has paid", () => {
    const allPaid = formatCostMessage(session, [row({ paid: true })], 5, ENTRY, GAME);
    expect(allPaid).toContain("✅ เก็บครบแล้ว");
  });

  it("stays well inside LINE's message limit for a full roster", () => {
    const big = Array.from({ length: 40 }, (_, i) => row({ id: `p${i}`, name: `ผู้เล่นคนที่ ${i}` }));
    expect(formatCostMessage(session, big, 60, ENTRY, GAME).length).toBeLessThan(4900);
  });

  it("skips a block nobody played", () => {
    const earlyOnly = formatCostMessage(session, [rows[0]], 10, ENTRY, GAME);
    expect(earlyOnly).not.toContain("รอบ 2 ทุ่ม");
  });
});

describe("openDayMessage", () => {
  it("says why there are no figures yet", () => {
    const text = openDayMessage(session);
    expect(text).toContain("Monday 03.08.2026");
    expect(text).toContain("ยังไม่ปิดรอบ");
  });
});
