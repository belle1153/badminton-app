"use client";

import { useState } from "react";

/**
 * Posts the "sign-ups are open" message to the LINE group on demand — the admin
 * taps it at 11:00. The server is idempotent (shares a stamp with the Friday
 * cron), so a second tap just reports it was already sent rather than spamming.
 */
export default function AnnounceRegistrationButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function announce() {
    if (loading) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/announce-registration", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ text: data.error ?? "แจ้งไม่สำเร็จ", ok: false });
      } else if (data.sent) {
        setMsg({ text: `ส่งแล้ว ✓ (${data.days.length} วัน)`, ok: true });
      } else {
        setMsg({ text: data.reason ?? "ไม่มีวันที่ต้องแจ้ง", ok: false });
      }
    } catch {
      setMsg({ text: "เชื่อมต่อไม่สำเร็จ", ok: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-brand-200 bg-brand-50/50 p-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm text-gray-600">แจ้งเปิดรับสมัครเข้ากลุ่ม LINE (กด 11 โมง)</span>
        <button
          onClick={announce}
          disabled={loading}
          className="shrink-0 rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "กำลังส่ง…" : "📣 แจ้งเปิดรับสมัคร"}
        </button>
      </div>
      {msg && (
        <p className={`text-xs ${msg.ok ? "text-green-600" : "text-gray-500"}`}>{msg.text}</p>
      )}
    </div>
  );
}
