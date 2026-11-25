import { describe, expect, it } from "vitest";
import { assignSeats, selfSignUpBlocked, WAITLIST_LIMIT } from "./signup";
import { blockCapacities, parseMaxPlayers } from "./capacity";

describe("selfSignUpBlocked", () => {
  it("lets players sign up while the day and registration are both open", () => {
    expect(selfSignUpBlocked({ status: "OPEN", registrationClosedAt: null })).toBeNull();
  });

  // 2026-11-11: the admin pressed "ปิดรับสมัคร" and a player still got in as a
  // reserve. Closing registration must stop every self sign-up, reserves too.
  it("blocks players once the admin closes registration", () => {
    expect(
      selfSignUpBlocked({ status: "OPEN", registrationClosedAt: new Date("2026-11-11T00:08:07Z") })
    ).toBe("ปิดรับสมัครแล้ว ลงชื่อเพิ่มไม่ได้ครับ");
  });

  it("blocks players once the day itself is closed", () => {
    expect(selfSignUpBlocked({ status: "CLOSED", registrationClosedAt: null })).toBe(
      "รอบนี้ปิดแล้ว ไม่สามารถลงชื่อได้"
    );
  });
});

// 2026-11-25: capacity is typed per day now, not fixed at 28. The 5 reserves
// stay on top of whatever the day takes.
describe("assignSeats with a day that takes 20 people (2 early courts)", () => {
  const { earlyCapacity, totalCapacity } = blockCapacities({ maxPlayers: 20, courtsEarly: 2 });
  const lateCap = totalCapacity - earlyCapacity;
  const people = (n: number, slot: "EARLY" | "LATE" = "EARLY") =>
    Array.from({ length: n }, (_, i) => ({
      id: `p${i + 1}`,
      preferredSlot: slot,
      createdAt: new Date(Date.UTC(2026, 10, 25, 0, i)),
    }));

  it("splits 14 early seats (2 courts) and 6 late seats", () => {
    expect(earlyCapacity).toBe(14);
    expect(lateCap).toBe(6);
  });

  it("seats 20, then 5 reserves, then nobody", () => {
    const out = assignSeats(people(26), earlyCapacity, lateCap, WAITLIST_LIMIT);
    expect(out.filter((r) => r.status === "CONFIRMED")).toHaveLength(20);
    expect(out.filter((r) => r.timeSlot === "EARLY" && r.status === "CONFIRMED")).toHaveLength(14);
    // Early-wanters past the 14 early seats take the 6 late ones (seats 15–20).
    expect(out[14]).toMatchObject({ status: "CONFIRMED", timeSlot: "LATE", slotNumber: 15 });
    expect(out[19]).toMatchObject({ status: "CONFIRMED", timeSlot: "LATE", slotNumber: 20 });
    const reserves = out.filter((r) => r.status === "WAITLIST");
    expect(reserves).toHaveLength(6);
    expect(reserves.filter((r) => r.placed)).toHaveLength(5);
    expect(out[25].placed).toBe(false);
  });

  it("never seats more early players than the day takes", () => {
    const small = blockCapacities({ maxPlayers: 10, courtsEarly: 3 });
    expect(small).toEqual({ earlyCapacity: 10, totalCapacity: 10 });
    const out = assignSeats(people(16, "LATE"), small.earlyCapacity, 0, WAITLIST_LIMIT);
    // No late seats at all: a late-only player can only be a reserve.
    expect(out.filter((r) => r.status === "CONFIRMED")).toHaveLength(0);
    expect(out.filter((r) => r.placed)).toHaveLength(5);
  });
});

describe("parseMaxPlayers", () => {
  it("takes a whole number 1–200 typed by the admin", () => {
    expect(parseMaxPlayers("20")).toBe(20);
    expect(parseMaxPlayers(36)).toBe(36);
  });
  it("rejects blanks, fractions and out-of-range numbers", () => {
    for (const bad of ["", " ", "0", "-3", "12.5", "abc", 201, null, undefined]) {
      expect(parseMaxPlayers(bad)).toBeNull();
    }
  });
});
