/**
 * LINE webhook signature check.
 *
 * The webhook is a public URL that can WITHDRAW a player from a day, so an
 * unsigned request must not be able to reach that code. LINE signs every
 * delivery with `X-Line-Signature`: base64(HMAC-SHA256(rawBody, channelSecret)).
 *
 * HMAC via WebCrypto, matching lib/adminCookie — available on both runtimes.
 */
const encoder = new TextEncoder();

export function lineSignatureConfigured(): boolean {
  return !!process.env.LINE_CHANNEL_SECRET;
}

function base64(bytes: ArrayBuffer): string {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Constant time for equal-length inputs — no early exit on first mismatch. */
function equals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * True when `signature` is LINE's signature for exactly this raw body.
 *
 * `rawBody` must be the untouched request text — re-serialising the parsed JSON
 * changes the bytes and the signature will never match.
 */
export async function verifyLineSignature(
  rawBody: string,
  signature: string | null,
  channelSecret: string
): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(channelSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  return equals(base64(mac), signature);
}
