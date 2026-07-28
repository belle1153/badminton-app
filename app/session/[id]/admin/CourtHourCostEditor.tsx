"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const HOURS = [19, 20, 21, 22];
const label = (h: number) => `${h}:00`;

/**
 * Lets the admin type the venue's actual court baht for each hour (19–22), so
 * the per-person bill matches the real charge when courts empty out late and a
 * whole-court × rate figure would over-bill. Blank = use the system's number.
 */
export default function CourtHourCostEditor({
  sessionId,
  initial,
  computed,
  isOverride,
}: {
  sessionId: string;
  /** Current values to show in the inputs (override if set, else the computed). */
  initial: number[];
  /** What the system would charge per hour, shown as a hint. */
  computed: number[];
  isOverride: boolean;
}) {
  const router = useRouter();
  const [vals, setVals] = useState<string[]>(HOURS.map((_, i) => String(initial[i] ?? 0)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(costs: number[] | null) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/court-hours`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ costs }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "บันทึกไม่สำเร็จ");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-md border border-gray-200 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">ค่าคอร์ทจริงรายชั่วโมง (บาท)</h3>
        {isOverride && <span className="text-[11px] text-brand-600">ใช้ค่าที่กรอกเอง</span>}
      </div>
      <p className="text-xs text-gray-400 -mt-1">
        กรอกค่าคอร์ทจริงของแต่ละชั่วโมง (เช่น ดึกๆ คอร์ทว่าง จ่ายน้อยลง) ระบบจะหารตามเวลาที่แต่ละคนอยู่ให้
      </p>
      <div className="grid grid-cols-4 gap-2">
        {HOURS.map((h, i) => (
          <label key={h} className="flex flex-col gap-1 text-xs text-gray-600">
            {label(h)}–{label(h + 1)}
            <input
              type="number"
              min={0}
              value={vals[i]}
              onChange={(e) => setVals((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
              className="input text-sm"
            />
            <span className="text-[10px] text-gray-400">ระบบคิด {computed[i] ?? 0}</span>
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => save(vals.map((v) => Number(v) || 0))}
          disabled={loading}
          className="rounded-md bg-brand-600 text-white text-sm font-medium px-3 py-1.5 hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "กำลังบันทึก…" : "บันทึกค่าคอร์ทจริง"}
        </button>
        {isOverride && (
          <button
            onClick={() => save(null)}
            disabled={loading}
            className="rounded-md border border-gray-300 text-gray-600 text-sm font-medium px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
          >
            กลับไปใช้ค่าที่ระบบคิด
          </button>
        )}
      </div>
    </section>
  );
}
