"use client";

import { useState } from "react";

/**
 * Posts the "sign-ups are open" message to the LINE group on demand — the admin
 * taps it at 11:00. The server is idempotent (shares a stamp with the Friday
 * cron), so a second tap just reports it was already sent rather than spamming.
 *
 * If the push fails (most likely 429 — the monthly push quota is used up) the
 * server hands back the composed text, which we show with a copy button so the
 * admin can paste it into the group by hand. Typing in LINE is free; only push
 * draws on the quota.
 */
export default function AnnounceRegistrationButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function announce() {
    if (loading) return;
    setLoading(true);
    setMsg(null);
    setFallback(null);
    setCopied(false);
    try {
      const res = await fetch("/api/admin/announce-registration", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ text: data.error ?? "แจ้งไม่สำเร็จ", ok: false });
      } else if (data.sent) {
        setMsg({ text: `ส่งแล้ว ✓ (${data.days.length} วัน)`, ok: true });
      } else {
        setMsg({ text: data.reason ?? "ไม่มีวันที่ต้องแจ้ง", ok: false });
        if (data.message) setFallback(data.message);
      }
    } catch {
      setMsg({ text: "เชื่อมต่อไม่สำเร็จ", ok: false });
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!fallback) return;
    try {
      await navigator.clipboard.writeText(fallback);
      setCopied(true);
    } catch {
      setCopied(false);
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

      {msg && <p className={`text-xs ${msg.ok ? "text-green-600" : "text-gray-500"}`}>{msg.text}</p>}

      {fallback && (
        <div className="flex flex-col gap-1.5 mt-1">
          <p className="text-xs text-gray-500">ส่งอัตโนมัติไม่ได้ — ก๊อปข้อความนี้ไปวางในกลุ่มเองได้ (ฟรี)</p>
          <textarea
            readOnly
            value={fallback}
            rows={7}
            className="w-full rounded-md border border-gray-300 p-2 text-xs font-mono"
          />
          <button
            onClick={copy}
            className="self-start rounded-md border border-brand-300 text-brand-700 px-3 py-1.5 text-xs font-medium hover:bg-brand-50"
          >
            {copied ? "คัดลอกแล้ว ✓" : "📋 คัดลอกข้อความ"}
          </button>
        </div>
      )}
    </div>
  );
}
