import { describe, it, expect } from "vitest";
import { verifyLineSignature } from "./lineSignature";

const SECRET = "channel-secret-abc123";
const BODY = JSON.stringify({
  events: [{ type: "message", replyToken: "r1", message: { type: "text", text: "ถอนชื่อ Alex" } }],
});

/** LINE's own recipe, computed independently of the code under test. */
async function sign(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  let binary = "";
  for (const b of new Uint8Array(mac)) binary += String.fromCharCode(b);
  return btoa(binary);
}

describe("verifyLineSignature", () => {
  it("accepts a genuine LINE signature", async () => {
    expect(await verifyLineSignature(BODY, await sign(BODY, SECRET), SECRET)).toBe(true);
  });

  it("rejects a forged request with no signature at all", async () => {
    // The attack this exists for: a plain POST of a "ถอนชื่อ <name>" event
    // would otherwise withdraw that player from the next open day.
    expect(await verifyLineSignature(BODY, null, SECRET)).toBe(false);
    expect(await verifyLineSignature(BODY, "", SECRET)).toBe(false);
  });

  it("rejects a signature made with the wrong secret", async () => {
    expect(await verifyLineSignature(BODY, await sign(BODY, "not-the-secret"), SECRET)).toBe(false);
  });

  it("rejects a body edited after it was signed", async () => {
    const sig = await sign(BODY, SECRET);
    const tampered = BODY.replace("Alex", "Bank");
    expect(await verifyLineSignature(tampered, sig, SECRET)).toBe(false);
  });

  it("rejects a body that only differs by whitespace", async () => {
    // Why the route must hash the raw text and not a re-serialised object:
    // the same JSON formatted differently is a different signature.
    const sig = await sign(BODY, SECRET);
    expect(await verifyLineSignature(JSON.stringify(JSON.parse(BODY), null, 2), sig, SECRET)).toBe(
      false
    );
  });

  it("rejects a truncated signature rather than matching a prefix", async () => {
    const sig = await sign(BODY, SECRET);
    expect(await verifyLineSignature(BODY, sig.slice(0, -1), SECRET)).toBe(false);
  });

  it("verifies an empty body, as LINE's webhook-verify ping sends", async () => {
    const empty = JSON.stringify({ events: [] });
    expect(await verifyLineSignature(empty, await sign(empty, SECRET), SECRET)).toBe(true);
  });
});
