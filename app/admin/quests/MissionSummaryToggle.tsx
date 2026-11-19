"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Admin switch for the player-facing มิชชั่นโคตรตึง summary page. */
export default function MissionSummaryToggle({ open }: { open: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/mission-summary", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ open: next }),
      });
      if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "บันทึกไม่สำเร็จ");
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองอีกครั้ง");
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold">🏆 หน้าสรุปมิชชั่นโคตรตึง</h2>
        <p className="text-sm text-gray-500">
          3 อันดับแรก 7 หมวด (เล่นมากสุด มาบ่อยสุด Win rate แพ้ เสมอ ถอนชื่อ เหรียญ) ระบบคำนวณสดจากผลเกมทุกครั้ง
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          id="mission-summary-open"
          type="checkbox"
          checked={open}
          disabled={busy}
          onChange={(e) => set(e.target.checked)}
          className="h-5 w-5"
        />
        {open ? "เปิดให้ผู้เล่นดูแล้ว (มีการ์ดที่หน้าแรกและหน้าอันดับ)" : "ผู้เล่นเห็น \"Coming soon\" (ยังไม่เปิด)"}
      </label>
      {error && <p className="ui-msg text-sm text-red-600">{error}</p>}
      <Link
        href="/leaderboard/summary"
        className="flex min-h-11 items-center self-start rounded-lg border border-brand-300 px-4 text-sm font-semibold text-brand-700"
      >
        ดูหน้าสรุป
      </Link>
    </section>
  );
}
