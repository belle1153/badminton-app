import { describe, it, expect } from "vitest";
import { pickAnnounceable, formatOpenMessage } from "./registrationAnnounce";

// A Monday session (27 July 2026). Sign-ups are open from the moment a day is
// created, so the only rule left is "the day hasn't been played yet".
const monday = { id: "m", date: new Date("2026-07-27T00:00:00.000Z"), startTime: "19:00" };
const at = (iso: string) => new Date(iso);

describe("pickAnnounceable — what the admin's button may post", () => {
  it("allows a day well before it, with no Friday 11:00 wait", () => {
    // Tuesday the week before, 08:00 ICT.
    expect(pickAnnounceable([monday], at("2026-07-21T01:00:00.000Z"))).toHaveLength(1);
  });

  it("includes the day itself, right up to the end of it", () => {
    // 27 July 23:00 ICT — people can still be told the day is on.
    expect(pickAnnounceable([monday], at("2026-07-27T16:00:00.000Z"))).toHaveLength(1);
  });

  it("refuses a day that has already been played", () => {
    // Otherwise a session left OPEN could be announced weeks later.
    expect(pickAnnounceable([monday], at("2026-07-28T01:00:00.000Z"))).toHaveLength(0);
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
