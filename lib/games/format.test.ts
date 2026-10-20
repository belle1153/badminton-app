import { describe, it, expect } from "vitest";
import { fmtMinute, setsLine, pairName, resultText, setsResultText, knockoutPlaceholder } from "./format";

describe("display helpers", () => {
  it("formats minutes since midnight as HH:MM", () => {
    expect(fmtMinute(840)).toBe("14:00");
    expect(fmtMinute(1290)).toBe("21:30");
    expect(fmtMinute(905)).toBe("15:05");
  });

  it("joins set scores without a 'เซต' prefix", () => {
    expect(setsLine([[15, 21], [19, 21]])).toBe("15–21 · 19–21");
    expect(setsLine([])).toBe("");
  });

  it("names a pair, or nothing when the lineup is not in yet", () => {
    expect(pairName([{ name: "ต้น" }, { name: "บอล" }])).toBe("ต้น + บอล");
    expect(pairName([{ name: "ต้น" }, null])).toBe("ต้น");
    expect(pairName([null, null])).toBe(null);
  });

  it("describes a rubber result with the points it earned", () => {
    expect(resultText("QUALIFIER", "A", "แดง", "น้ำเงิน")).toBe("แดง ชนะ +2");
    expect(resultText("QUALIFIER", "DRAW", "แดง", "น้ำเงิน")).toBe("เสมอ +1 ทั้งสองทีม");
    expect(resultText("FINAL", "B", "แดง", "น้ำเงิน")).toBe("น้ำเงิน ชนะ +1");
    expect(resultText("SEMI", null, "แดง", "น้ำเงิน")).toBe("");
  });

  it("counts every set of a finished rubber for the sets-won line", () => {
    expect(setsResultText([[21, 19], [21, 17]], "A", "แดง", "เหลือง")).toBe("แดง ชนะ 2–0 เซต");
    expect(setsResultText([[21, 15], [18, 21]], "DRAW", "แดง", "เหลือง")).toBe("เสมอ 1–1 เซต");
    expect(setsResultText([[19, 21], [21, 10], [15, 21]], "B", "แดง", "เหลือง")).toBe("เหลือง ชนะ 2–1 เซต");
    expect(setsResultText([[3, 2]], null, "แดง", "เหลือง")).toBe("");
  });

  it("explains an undecided knockout pairing", () => {
    expect(knockoutPlaceholder("SEMI", 1)).toBe("อันดับ 1 vs อันดับ 4");
    expect(knockoutPlaceholder("SEMI", 2)).toBe("อันดับ 2 vs อันดับ 3");
    expect(knockoutPlaceholder("FIFTH", 1)).toBe("อันดับ 5 vs อันดับ 6");
    expect(knockoutPlaceholder("THIRD", 1)).toBe("ผู้แพ้รองฯ 1 vs ผู้แพ้รองฯ 2");
    expect(knockoutPlaceholder("FINAL", 1)).toBe("ผู้ชนะรองฯ 1 vs ผู้ชนะรองฯ 2");
  });
});
