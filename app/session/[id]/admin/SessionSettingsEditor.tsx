"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { capacityFor, parseMaxPlayers } from "@/lib/capacity";
import { normalizeStartTime, slotLabel } from "@/lib/sessionTime";
import { WAITLIST_LIMIT } from "@/lib/signup";

/**
 * The day's start time and how many people it takes, editable after the day
 * was created (the club can't always lock its courts for 19:00). The second
 * block starts an hour after the start; the 5 reserves come on top of the
 * capacity. Changing the capacity re-seats everyone in sign-up order.
 */
export default function SessionSettingsEditor({
  sessionId,
  startTime: initialStart,
  maxPlayers: initialMax,
  courtsEarly,
  activeCount,
}: {
  sessionId: string;
  startTime: string;
  maxPlayers: number;
  courtsEarly: number;
  /** Names currently holding a seat or a reserve place. */
  activeCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(initialStart);
  const [max, setMax] = useState(String(initialMax));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validStart = normalizeStartTime(start);
  const validMax = parseMaxPlayers(max);
  const overflow = validMax != null && activeCount > validMax + WAITLIST_LIMIT;

  async function save() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startTime: start, maxPlayers: max }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "บันทึกไม่สำเร็จ");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <section className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm">
        <span className="text-gray-600">
          เริ่ม <b>{initialStart}</b> น. · รับ <b>{initialMax}</b> คน + สำรอง {WAITLIST_LIMIT}
        </span>
        <button
          onClick={() => {
            setStart(initialStart);
            setMax(String(initialMax));
            setError(null);
            setOpen(true);
          }}
          className="text-brand-700 font-medium hover:underline shrink-0"
        >
          แก้ไข
        </button>
      </section>
    );
  }

  return (
    <section className="ui-fade-in flex flex-col gap-3 rounded-md border border-gray-200 p-3">
      <h2 className="font-semibold text-sm">แก้เวลาเริ่ม / จำนวนคน</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          เวลาเริ่ม
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="input py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          รับกี่คน
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={200}
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className="input py-1.5 text-sm"
          />
        </label>
      </div>
      {validStart && validMax != null ? (
        <p className="text-xs text-gray-500">
          รอบ {slotLabel(validStart, "EARLY")} {Math.min(capacityFor(courtsEarly), validMax)} คน · รอบ{" "}
          {slotLabel(validStart, "LATE")} เพิ่มอีก {Math.max(0, validMax - capacityFor(courtsEarly))} คน +
          สำรอง {WAITLIST_LIMIT} คน
        </p>
      ) : (
        <p className="text-xs text-amber-600">
          {!validStart ? "เวลาเริ่มไม่ถูกต้อง" : "จำนวนคนที่รับต้องเป็นเลข 1–200"}
        </p>
      )}
      {overflow && (
        <p className="text-xs text-amber-600">
          ตอนนี้มีคนลงชื่อ {activeCount} คน เกินที่รับ + สำรอง คนที่ลงทีหลังสุดจะเป็นสำรองเกินโควตา
        </p>
      )}
      {error && <p className="ui-msg text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={loading || !validStart || validMax == null}
          className="rounded-md bg-brand-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md border border-gray-300 text-gray-600 px-4 py-1.5 text-sm font-medium hover:bg-gray-50"
        >
          ยกเลิก
        </button>
      </div>
    </section>
  );
}
