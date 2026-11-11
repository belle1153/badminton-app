import { describe, expect, it } from "vitest";
import { selfSignUpBlocked } from "./signup";

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
