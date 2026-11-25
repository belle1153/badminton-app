"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COURT_OPTIONS, capacityFor } from "@/lib/capacity";
import { slotLabel } from "@/lib/sessionTime";

/**
 * Edit how many courts a session uses in each time block after it has been
 * created. The day's capacity is set on its own (SessionSettingsEditor); the
 * early-block court count still decides how many of those seats are in the
 * first block, so saving re-seats everyone.
 */
export default function CourtCountEditor({
  sessionId,
  courtsEarly: initialEarly,
  courtsLate: initialLate,
  startTime,
  maxPlayers,
}: {
  sessionId: string;
  courtsEarly: number;
  courtsLate: number;
  startTime: string;
  maxPlayers: number;
}) {
  const earlyName = slotLabel(startTime, "EARLY");
  const lateName = slotLabel(startTime, "LATE");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [early, setEarly] = useState(initialEarly);
  const [late, setLate] = useState(initialLate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalid = late < early;

  async function save() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtsEarly: early, courtsLate: late }),
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
      <section className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm">
        <span className="text-gray-600">
          คอร์ท: {earlyName} {initialEarly} คอร์ท · {lateName} {initialLate} คอร์ท
        </span>
        <button
          onClick={() => {
            setEarly(initialEarly);
            setLate(initialLate);
            setOpen(true);
          }}
          className="text-brand-700 font-medium hover:underline"
        >
          แก้ไข
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-gray-200 p-3">
      <h2 className="font-semibold text-sm">แก้จำนวนคอร์ท</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          คอร์ทช่วง {earlyName}
          <select
            value={early}
            onChange={(e) => setEarly(Number(e.target.value))}
            className="input py-1.5 text-sm"
          >
            {COURT_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c} คอร์ท
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          คอร์ทช่วง {lateName}
          <select
            value={late}
            onChange={(e) => setLate(Number(e.target.value))}
            className="input py-1.5 text-sm"
          >
            {COURT_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c} คอร์ท
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-gray-500">
        รับรวม {maxPlayers} คน (ช่วง {earlyName} {Math.min(capacityFor(early), maxPlayers)} คน)
      </p>
      {invalid && (
        <p className="text-xs text-amber-600">
          คอร์ทช่วง {lateName} ต้องไม่น้อยกว่าช่วง {earlyName}
        </p>
      )}
      {error && <p className="ui-msg text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={loading || invalid}
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
