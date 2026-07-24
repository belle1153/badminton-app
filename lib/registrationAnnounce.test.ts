import { describe, it, expect } from "vitest";
import { pickFreshlyOpen, formatOpenMessage } from "./registrationAnnounce";

// A Monday session; its sign-ups open the Friday before at 11:00 ICT
// (2026-07-24 11:00 ICT = 2026-07-24 04:00 UTC).
const monday = { id: "m", date: new Date("2026-07-27T00:00:00.000Z"), startTime: "19:00" };
const at = (iso: string) => new Date(iso);

describe("pickFreshlyOpen — Friday-11:00 timing", () => {
  it("includes a day right after it opens", () => {
    expect(pickFreshlyOpen([monday], at("2026-07-24T04:30:00.000Z"))).toHaveLength(1);
  });

  it("includes it exactly at the open instant", () => {
    expect(pickFreshlyOpen([monday], at("2026-07-24T04:00:00.000Z"))).toHaveLength(1);
  });

  it("excludes it before sign-ups open", () => {
    expect(pickFreshlyOpen([monday], at("2026-07-24T03:59:00.000Z"))).toHaveLength(0);
  });

  it("excludes it once the 24h fresh window has passed (no stale backfill)", () => {
    expect(pickFreshlyOpen([monday], at("2026-07-25T05:00:00.000Z"))).toHaveLength(0);
  });
});

describe("formatOpenMessage", () => {
  const msg = formatOpenMessage([monday], "https://signup.example");

  it("announces registration is open with the sign-up link", () => {
    expect(msg).toContain("เปิดรับสมัครแล้ว");
    expect(msg).toContain("https://signup.example");
  });

  it("lists the day (Thai date) and its start time", () => {
    expect(msg).toContain("27"); // 27 กรกฎาคม
    expect(msg).toContain("เริ่ม 19:00 น.");
  });

  it("lists every given day", () => {
    const two = formatOpenMessage(
      [monday, { id: "w", date: new Date("2026-07-29T00:00:00.000Z"), startTime: "19:00" }],
      "https://signup.example"
    );
    expect(two).toContain("27");
    expect(two).toContain("29");
  });
});
