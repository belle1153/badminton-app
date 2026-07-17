/**
 * Admin session cookie, shared by the server (lib/adminAuth) and the Edge proxy.
 * Kept free of `next/headers` so proxy.ts can import it.
 *
 * The cookie holds a SIGNED token, never the PIN itself: a stolen cookie can't
 * be read back into the password, and a guessed cookie won't verify. Signing is
 * HMAC-SHA256 via WebCrypto, which both the Node and Edge runtimes provide.
 */
const encoder = new TextEncoder();

export const ADMIN_COOKIE_NAME = "badminton_admin";

/** How long a login lasts before the admin has to sign in again. */
export const ADMIN_SESSION_DAYS = 30;

export function adminPin(): string {
  return process.env.ADMIN_PIN ?? "1234";
}

export function isValidPin(pin: string): boolean {
  // Constant-time-ish: compare full strings, don't bail on first mismatch.
  const expected = adminPin();
  if (pin.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < pin.length; i++) diff |= pin.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** Secret for signing. Falls back to the PIN so the app still works unconfigured,
 *  but ADMIN_SECRET should be set to a long random value in production. */
function secret(): string {
  return process.env.ADMIN_SECRET ?? `pin:${adminPin()}`;
}

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const b of view) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return base64url(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

/** Mint a cookie value for a fresh login: "<expiry-ms>.<signature>". */
export async function issueAdminToken(now: number = Date.now()): Promise<string> {
  const expiresAt = now + ADMIN_SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = String(expiresAt);
  return `${payload}.${await sign(payload)}`;
}

/** True only for a token this server signed that hasn't expired. */
export async function verifyAdminToken(
  token: string | undefined,
  now: number = Date.now()
): Promise<boolean> {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;

  const payload = token.slice(0, dot);
  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || expiresAt < now) return false;

  const expected = await sign(payload);
  const given = token.slice(dot + 1);
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
