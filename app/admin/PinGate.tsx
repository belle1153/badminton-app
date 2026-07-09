"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PinGate({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "PIN ไม่ถูกต้อง");
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xs mx-auto flex flex-col gap-3 p-6">
      <h1 className="text-lg font-bold text-center">หน้าแอดมิน</h1>
      <input
        type="password"
        autoFocus
        placeholder="Admin PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        className="input"
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
      >
        {loading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
