"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Close / reopen the day. Closing locks the day and reveals the per-person bill
 * (flat entry + per-game fee) to players; it carries no cost figures of its own
 * anymore — the club doesn't track court or ball cost in the app.
 */
export default function CostPanel({
  sessionId,
  status,
}: {
  sessionId: string;
  status: "OPEN" | "CLOSED";
}) {
  const router = useRouter();
  const isClosed = status === "CLOSED";

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClose() {
    if (!confirm("ปิดวันนี้? ผู้เล่นจะเห็นยอดที่ต้องจ่าย")) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/close`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ปิดวันไม่สำเร็จ");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  async function handleReopen() {
    if (!confirm("เปิดวันนี้อีกครั้ง? ยอดจะกลับไปแก้ไขได้")) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/reopen`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เปิดวันไม่สำเร็จ");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">ปิดวัน{isClosed ? " (ปิดแล้ว)" : ""}</h2>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {isClosed ? (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-gray-500">ปิดวันแล้ว — ผู้เล่นเห็นยอดที่ต้องจ่ายในหน้าค่าใช้จ่ายแล้ว</p>
          <button
            onClick={handleReopen}
            disabled={loading}
            className="rounded-md border border-brand-400 text-brand-700 px-4 py-2 text-sm font-medium hover:bg-brand-50 disabled:opacity-50 self-start"
          >
            {loading ? "กำลังเปิด..." : "เปิดวันอีกครั้ง"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400">
            ปิดวันเพื่อล็อกยอด — หลังปิด ผู้เล่นจะเห็นยอดรายคน (ค่าสนาม + ค่าลูก) และยอดค้างในไลน์
          </p>
          <button
            onClick={handleClose}
            disabled={loading}
            className="rounded-md bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 self-start"
          >
            {loading ? "กำลังปิดวัน..." : "ปิดวัน"}
          </button>
        </div>
      )}
    </section>
  );
}
