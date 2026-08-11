import { describe, expect, it } from "vitest";
import { formatCostMessage, openDayMessage } from "./lineCost";
import { type CostRow } from "./costing";

const session = {
  date: new Date(Date.UTC(2026, 7, 3)), // Monday 03.08.2026
  venue: "แหลมฉบัง",
  courtsEarly: 3,
  courtsLate: 5,
};

const row = (over: Partial<CostRow>): CostRow => ({
  id: over.name ?? "x",
  name: "ใครสักคน",
  slot: "19.00",
  timeSlot: "EARLY",
  out: null,
  hours: 2,
  games: 3,
  courtBaht: 66,
  ballShareBaht: 73.5,
  totalBaht: 140,
  live: false,
  noShow: false,
  ...over,
});

describe("formatCostMessage", () => {
  const rows = [
    row({ name: "พี่เอียด", totalBaht: 166, hours: 3 }),
    row({ name: "Ja", timeSlot: "LATE", slot: "20.00", totalBaht: 87, games: 1 }),
    row({
      name: "Bankki",
      hours: null,
      games: 0,
      courtBaht: 0,
      ballShareBaht: 0,
      totalBaht: 100,
      noShow: true,
    }),
  ];
  const text = formatCostMessage(session, rows, 42);

  it("heads with the day, venue and game count", () => {
    expect(text).toContain("🗓 Monday 03.08.2026 · แหลมฉบัง");
    expect(text).toContain("42 เกม");
  });

  it("splits the two blocks and bills each player", () => {
    expect(text).toContain("🔸รอบ 1 ทุ่ม (19.00)🔸");
    expect(text).toContain("พี่เอียด — 166฿ (3 ชม. · 3 เกม)");
    expect(text).toContain("🔸รอบ 2 ทุ่ม (20.00)🔸");
    expect(text).toContain("Ja — 87฿ (2 ชม. · 1 เกม)");
  });

  it("lists no-shows separately with the fine", () => {
    expect(text).toContain("🔴 ไม่มา (ปรับ 100฿)");
    expect(text).toContain("Bankki — 100฿");
  });

  it("totals everyone, no-shows included", () => {
    expect(text).toContain("💵 รวมเก็บ 353 ฿ · 3 คน");
    expect(text).toContain("🏟 ค่าคอร์ท 132 ฿");
  });

  it("stays well inside LINE's message limit for a full roster", () => {
    const big = Array.from({ length: 40 }, (_, i) => row({ id: `p${i}`, name: `ผู้เล่นคนที่ ${i}` }));
    expect(formatCostMessage(session, big, 60).length).toBeLessThan(4900);
  });

  it("skips a block nobody played", () => {
    const earlyOnly = formatCostMessage(session, [rows[0]], 10);
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
