/**
 * Decode a stored `data:<mime>;base64,<payload>` string into servable bytes.
 * Images were historically inlined into HTML as data URLs; they now live behind
 * /api/... routes with real caching, so the stored form gets decoded once here.
 */
export function parseDataUrl(dataUrl: string): { mime: string; bytes: Buffer } | null {
  const m = /^data:([^;,]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!m) return null;
  try {
    return { mime: m[1], bytes: Buffer.from(m[2], "base64") };
  } catch {
    return null;
  }
}
