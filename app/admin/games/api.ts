/** Tiny JSON client for the /api/admin/games endpoints: always returns, never throws. */
export async function adminApi<T = Record<string, unknown>>(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error ?? "บันทึกไม่สำเร็จ" };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "เชื่อมต่อไม่ได้ ลองอีกครั้ง" };
  }
}
