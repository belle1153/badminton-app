"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegistrationToggle({
  sessionId,
  registrationClosed,
}: {
  sessionId: string;
  registrationClosed: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closed: !registrationClosed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ทำรายการไม่สำเร็จ");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex items-center justify-between gap-3 rounded-md border border-gray-200 p-3">
      <div>
        <h2 className="font-semibold">การรับสมัคร</h2>
        <p className="text-xs text-gray-500">
          {registrationClosed ? "ปิดรับสมัครแล้ว — ผู้เล่นใหม่ลงชื่อไม่ได้" : "เปิดรับสมัครอยู่"}
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 whitespace-nowrap ${
          registrationClosed
            ? "bg-brand-600 text-white hover:bg-brand-700"
            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
        }`}
      >
        {loading ? "กำลังทำรายการ..." : registrationClosed ? "เปิดรับสมัครอีกครั้ง" : "ปิดรับสมัคร"}
      </button>
    </section>
  );
}
