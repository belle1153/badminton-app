import { describe, it, expect } from "vitest";
import { issueAdminToken, verifyAdminToken, isValidPin, ADMIN_SESSION_DAYS } from "./adminCookie";

const DAY = 24 * 60 * 60 * 1000;

describe("admin session token", () => {
  it("accepts a token it just issued", async () => {
    expect(await verifyAdminToken(await issueAdminToken())).toBe(true);
  });

  it("never contains the PIN", async () => {
    const token = await issueAdminToken();
    expect(token).not.toContain(process.env.ADMIN_PIN ?? "1234");
  });

  it("rejects a missing or junk cookie", async () => {
    expect(await verifyAdminToken(undefined)).toBe(false);
    expect(await verifyAdminToken("")).toBe(false);
    expect(await verifyAdminToken("1234")).toBe(false); // the old raw-PIN cookie
    expect(await verifyAdminToken("nonsense")).toBe(false);
  });

  it("rejects a tampered signature", async () => {
    const token = await issueAdminToken();
    const [payload] = token.split(".");
    expect(await verifyAdminToken(`${payload}.deadbeef`)).toBe(false);
  });

  it("rejects an extended expiry — the signature covers it", async () => {
    const token = await issueAdminToken();
    const sig = token.slice(token.lastIndexOf(".") + 1);
    const forged = `${Date.now() + 999 * DAY}.${sig}`;
    expect(await verifyAdminToken(forged)).toBe(false);
  });

  it("expires on its own after the session window", async () => {
    const issued = await issueAdminToken(Date.now());
    const later = Date.now() + (ADMIN_SESSION_DAYS + 1) * DAY;
    expect(await verifyAdminToken(issued, later)).toBe(false);
  });
});

describe("isValidPin", () => {
  it("accepts the configured PIN and rejects near misses", () => {
    const pin = process.env.ADMIN_PIN ?? "1234";
    expect(isValidPin(pin)).toBe(true);
    expect(isValidPin(pin + "5")).toBe(false);
    expect(isValidPin("")).toBe(false);
    expect(isValidPin(pin.slice(0, -1))).toBe(false);
  });
});
