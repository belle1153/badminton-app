import { describe, it, expect } from "vitest";
import { parseQuestInput } from "./questInput";

const body = (over: Record<string, unknown> = {}) => ({
  title: "เหรียญสิงหา",
  kind: "days-played",
  icon: "🎯",
  startDate: "2026-08-01",
  endDate: "2026-09-01",
  target: "3",
  expReward: "200",
  ...over,
});

const ok = (over: Record<string, unknown> = {}) => {
  const r = parseQuestInput(body(over));
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`);
  return r.data;
};

const err = (over: Record<string, unknown>) => {
  const r = parseQuestInput(body(over));
  if (r.ok) throw new Error("expected a rejection");
  return r.error;
};

describe("parseQuestInput", () => {
  it("stores dates at UTC midnight, matching Session.date", () => {
    const d = ok();
    expect(d.startDate.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(d.endDate.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("takes numbers from the form's strings", () => {
    expect(ok({ target: "3", expReward: "250" })).toMatchObject({ target: 3, expReward: 250 });
  });

  it("rounds a fractional reward rather than storing it", () => {
    expect(ok({ expReward: "199.6" }).expReward).toBe(200);
  });

  it("defaults a blank icon instead of leaving the card empty", () => {
    expect(ok({ icon: "   " }).icon).toBe("🎯");
  });

  it("drops the target for rules that take none", () => {
    expect(ok({ kind: "perfect-attendance", target: "5" }).target).toBeNull();
  });

  it("rejects an empty title", () => {
    expect(err({ title: "   " })).toContain("ชื่อเควส");
  });

  it("rejects a kind evaluateQuest could not score", () => {
    expect(err({ kind: "vibes-based" })).toContain("ประเภทเควส");
  });

  it("rejects an end on or before the start, which would score nobody", () => {
    expect(err({ startDate: "2026-08-01", endDate: "2026-08-01" })).toContain("หลังวันเริ่ม");
    expect(err({ endDate: "2026-07-01" })).toContain("หลังวันเริ่ม");
  });

  it("rejects a missing target on a rule that needs one", () => {
    // Left empty, the rule can never complete — it would look live and be dead.
    expect(err({ target: "" })).toContain("จำนวนวัน");
    expect(err({ target: "0" })).toContain("จำนวนวัน");
  });

  it("rejects a reward of zero or less", () => {
    expect(err({ expReward: "0" })).toContain("EXP");
    expect(err({ expReward: "abc" })).toContain("EXP");
  });

  it("accepts the per-day rule, whose reward is a daily rate", () => {
    expect(ok({ kind: "fastest-signup-daily", target: "10" })).toMatchObject({
      kind: "fastest-signup-daily",
      target: 10,
    });
  });
});
