import { describe, expect, it } from "vitest";
import { formatBillMessages, type Debt } from "./lineBill";

describe("formatBillMessages", () => {
  const debts: Debt[] = [
    { name: "NW", total: 290, days: [{ label: "จ 4/8", baht: 95 }, { label: "พ 6/8", baht: 195 }] },
    { name: "Bankki", total: 120, days: [{ label: "พ 6/8", baht: 120 }] },
  ];
  const text = formatBillMessages(debts).join("\n");

  it("heads with the bill title", () => {
    expect(text).toContain("🧾 เรียกเก็บเงิน");
  });

  it("gives each person their running total", () => {
    expect(text).toContain("👤 NW — ค้าง 290฿");
    expect(text).toContain("👤 Bankki — ค้าง 120฿");
  });

  it("breaks a multi-day debt down by day, but not a single-day one", () => {
    expect(text).toContain("• จ 4/8 — 95฿");
    expect(text).toContain("• พ 6/8 — 195฿");
    // Bankki owes one day only — no redundant breakdown line.
    expect(text).not.toContain("• พ 6/8 — 120฿");
  });

  it("totals the grand outstanding across everyone", () => {
    expect(text).toContain("รวมค้าง 2 คน · 410฿");
  });

  it("sorts people by name", () => {
    expect(text.indexOf("Bankki")).toBeLessThan(text.indexOf("NW"));
  });

  it("says so when nothing is outstanding", () => {
    expect(formatBillMessages([])).toEqual(["✅ ไม่มียอดค้างใน 2 อาทิตย์ล่าสุดครับ"]);
  });

  it("splits into several messages for a very long list", () => {
    const many: Debt[] = Array.from({ length: 200 }, (_, i) => ({
      name: `ผู้เล่นคนที่ ${i}`,
      total: 195,
      days: [{ label: "จ 4/8", baht: 95 }, { label: "พ 6/8", baht: 100 }],
    }));
    const msgs = formatBillMessages(many);
    expect(msgs.length).toBeGreaterThan(1);
    expect(msgs.every((m) => m.length <= 4900)).toBe(true);
  });
});
