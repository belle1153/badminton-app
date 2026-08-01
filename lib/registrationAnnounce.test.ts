import { describe, it, expect } from "vitest";
import { pickCronRetryable, pickAnnounceable, formatOpenMessage } from "./registrationAnnounce";

// A Monday session; its sign-ups open the Friday before at 11:00 ICT
// (2026-07-24 11:00 ICT = 2026-07-24 04:00 UTC).
const monday = { id: "m", date: new Date("2026-07-27T00:00:00.000Z"), startTime: "19:00" };
const at = (iso: string) => new Date(iso);

describe("pickCronRetryable — Friday-11:00 timing", () => {
  it("includes a day right after it opens", () => {
    expect(pickCronRetryable([monday], at("2026-07-24T04:30:00.000Z"))).toHaveLength(1);
  });

  it("includes it exactly at the open instant", () => {
    expect(pickCronRetryable([monday], at("2026-07-24T04:00:00.000Z"))).toHaveLength(1);
  });

  it("excludes it before sign-ups open", () => {
    expect(pickCronRetryable([monday], at("2026-07-24T03:59:00.000Z"))).toHaveLength(0);
  });

  it("keeps retrying the next day, so a failed Friday is not lost", () => {
    // The cron runs daily now. A Friday send that failed (429, LINE down) gets
    // another go on Saturday and Sunday; the stamp stops it once one lands.
    expect(pickCronRetryable([monday], at("2026-07-25T04:00:00.000Z"))).toHaveLength(1);
    expect(pickCronRetryable([monday], at("2026-07-26T04:00:00.000Z"))).toHaveLength(1);
  });

  it("gives up after the retry window, so a first deploy backfills nothing", () => {
    // 3 days after opening, to the second.
    expect(pickCronRetryable([monday], at("2026-07-27T03:59:00.000Z"))).toHaveLength(1);
    expect(pickCronRetryable([monday], at("2026-07-27T04:00:00.000Z"))).toHaveLength(0);
  });

  it("never announces a day that has already been played", () => {
    expect(pickCronRetryable([monday], at("2026-07-28T01:00:00.000Z"))).toHaveLength(0);
  });
});

describe("pickAnnounceable — what the admin's button may post", () => {
  it("still allows it once the cron has given up, right up to game day", () => {
    // The bug this exists for: sign-ups opened Friday 11:00, the push failed
    // (429), and by Saturday the button reported "แจ้งไปแล้ว" for a day that
    // had never been announced at all — the announcement became unsendable.
    // Monday 13:00 ICT: past the cron's retry window, but the day is still on.
    const gameDay = at("2026-07-27T06:00:00.000Z");
    expect(pickCronRetryable([monday], gameDay)).toHaveLength(0);
    expect(pickAnnounceable([monday], gameDay)).toHaveLength(1);
  });

  it("still refuses before sign-ups open", () => {
    expect(pickAnnounceable([monday], at("2026-07-24T03:59:00.000Z"))).toHaveLength(0);
  });

  it("includes the day itself, right up to the end of it", () => {
    // 27 July 23:00 ICT — people can still be told the day is on.
    expect(pickAnnounceable([monday], at("2026-07-27T16:00:00.000Z"))).toHaveLength(1);
  });

  it("refuses a day that has already been played", () => {
    // Otherwise a session left OPEN could be announced weeks later.
    expect(pickAnnounceable([monday], at("2026-07-28T01:00:00.000Z"))).toHaveLength(0);
  });

  it("is a superset of what the cron would send", () => {
    for (const iso of [
      "2026-07-24T04:00:00.000Z",
      "2026-07-24T12:00:00.000Z",
      "2026-07-25T03:00:00.000Z",
    ]) {
      const cron = pickCronRetryable([monday], at(iso)).length;
      const manual = pickAnnounceable([monday], at(iso)).length;
      expect(manual).toBeGreaterThanOrEqual(cron);
    }
  });
});

describe("formatOpenMessage", () => {
  const msg = formatOpenMessage([monday], "https://signup.example");

  it("announces registration is open with the sign-up link", () => {
    expect(msg).toContain("เปิดลงชื่อแล้ว");
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
